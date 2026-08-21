'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const LINKS = [
  { href: '/', label: 'Today' },
  { href: '/schedule/', label: 'Schedule' },
  { href: '/history/', label: 'History' },
];

function isActive(pathname: string, href: string): boolean {
  const normalise = (p: string) => (p.endsWith('/') ? p : `${p}/`);
  return normalise(pathname) === normalise(href);
}

export function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              PT
            </span>
            <span className="text-base font-semibold text-slate-900">Physio Tracker</span>
          </Link>

          <div className="flex items-center gap-3">
            <nav className="hidden gap-1 sm:flex">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive(pathname, link.href)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {user && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile tab bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white sm:hidden">
        <div className="mx-auto flex max-w-3xl">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 px-3 py-3 text-center text-sm font-medium transition ${
                isActive(pathname, link.href)
                  ? 'text-brand-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
