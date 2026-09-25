'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { useAuth } from './useAuth';

export type PushState =
  | 'unsupported'   // browser has no Push API (or iOS Safari not installed to Home Screen)
  | 'checking'
  | 'off'           // supported, not subscribed
  | 'on'            // subscribed on this device
  | 'blocked';      // permission denied at the OS/browser level

/** VAPID public keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function usePush() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Work out where we stand without prompting for anything.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported()) {
        if (!cancelled) setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('blocked');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setState(sub ? 'on' : 'off');
      } catch {
        if (!cancelled) setState('off');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!supported()) {
        setState('unsupported');
        return;
      }

      // Must follow a user gesture, which is why this lives behind a button.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const supabase = getSupabase();

      // Ask the server for the VAPID public key. The function generates the
      // pair on first call and keeps the private half; nothing secret is ever
      // shipped to the browser.
      const { data: initData, error: initError } = await supabase.functions.invoke(
        'physio-push',
        { body: { action: 'init' } },
      );
      if (initError) throw initError;
      const publicKey: string | undefined = initData?.publicKey;
      if (!publicKey) throw new Error('The server did not return a push key.');

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));

      const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      if (!raw.endpoint || !raw.keys) throw new Error('The browser returned an incomplete subscription.');

      const { error: saveError } = await supabase.from('physio_push_subscriptions').upsert(
        {
          user_id: user?.id,
          endpoint: raw.endpoint,
          p256dh: raw.keys.p256dh,
          auth: raw.keys.auth,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto',
          user_agent: navigator.userAgent.slice(0, 300),
          failure_count: 0,
        },
        { onConflict: 'endpoint' },
      );
      if (saveError) throw saveError;

      setState('on');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [user]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await getSupabase().from('physio_push_subscriptions').delete().eq('endpoint', endpoint);
      }
      setState('off');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable };
}
