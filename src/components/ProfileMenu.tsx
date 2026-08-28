'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { displayName } from '@/lib/user';
import { Avatar } from './Avatar';
import { ThemeSegmented } from './ThemeToggle';
import { ChevronDownIcon, LogOutIcon, UserIcon } from './icons';

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const name = displayName(user);

  // Close on outside click and on Escape; Escape also returns focus to the
  // trigger so keyboard users do not lose their place.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Move focus into the menu when it opens via the keyboard.
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[data-menu-item]');
    first?.focus();
  }, [open]);

  if (!user) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="focus-ring flex items-center gap-1 rounded-xl border border-line bg-surface
          p-1 pr-1.5 transition hover:border-accent/40"
      >
        <Avatar name={name} seed={user.id} size="sm" className="!h-7 !w-7 !text-[11px]" />
        <ChevronDownIcon
          className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          className="animate-rise-in absolute right-0 z-40 mt-2 w-64 origin-top-right
            rounded-2xl border border-line bg-surface p-2 shadow-pop"
        >
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={name} seed={user.id} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>

          <div className="my-1.5 h-px bg-line" />

          <Link
            href="/profile/"
            role="menuitem"
            data-menu-item
            onClick={() => setOpen(false)}
            className="focus-ring flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm
              font-medium text-ink transition hover:bg-panel"
          >
            <UserIcon className="h-4 w-4 text-muted" />
            Profile &amp; settings
          </Link>

          <div className="px-2.5 pb-1 pt-2.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
              Theme
            </p>
            <ThemeSegmented />
          </div>

          <div className="my-1.5 h-px bg-line" />

          <button
            type="button"
            role="menuitem"
            data-menu-item
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="focus-ring flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2
              text-sm font-medium text-ink transition hover:bg-danger-soft hover:text-danger-soft-fg"
          >
            <LogOutIcon className="h-4 w-4 text-muted" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
