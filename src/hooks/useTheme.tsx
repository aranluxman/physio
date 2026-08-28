'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'physio-theme';

interface ThemeContextValue {
  /** What the user chose: an explicit theme, or "follow the OS". */
  preference: ThemePreference;
  /** What is actually on screen right now. */
  theme: ResolvedTheme;
  /** False during the server render and the hydration pass. */
  mounted: boolean;
  setPreference: (preference: ThemePreference) => void;
  /** Flip between light and dark, leaving "system" behind. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Private mode / blocked storage — fall back to the OS setting.
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  /*
   * Two inputs, one derived answer. An earlier version kept `resolved` in its
   * own state and wrote to it from two different effects; the media-query
   * effect still held the first render's `preference` ("system") and would
   * overwrite a stored "dark" with the OS value. Deriving instead makes that
   * class of bug impossible.
   *
   * Both are initialised lazily from the real environment, so the very first
   * client render already agrees with what the inline boot script painted.
   */
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark);
  const [mounted, setMounted] = useState(false);

  const resolved: ResolvedTheme =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => setMounted(true), []);

  // Follow the OS at all times; whether it matters is decided by `preference`.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not fatal: the theme still applies for this session.
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme: resolved, mounted, setPreference, toggle }),
    [preference, resolved, mounted, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
