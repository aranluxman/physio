'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartIcon, CalendarIcon, TodayIcon } from './icons';
import { ThemeToggle } from './ThemeToggle';
import { ProfileMenu } from './ProfileMenu';

const LINKS = [
  { href: '/', label: 'Today', Icon: TodayIcon },
  { href: '/schedule/', label: 'Schedule', Icon: CalendarIcon },
  { href: '/history/', label: 'History', Icon: ChartIcon },
];

const normalise = (p: string) => (p.endsWith('/') ? p : `${p}/`);
const isActive = (pathname: string, href: string) =>
  normalise(pathname) === normalise(href);

export function NavBar() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="focus-ring group flex items-center gap-2.5 rounded-lg"
            aria-label="Physio Tracker, go to today"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent
                text-accent-fg shadow-card transition group-hover:scale-105"
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
                {/* Rising bars: sessions stacking up over time. */}
                <path
                  d="M5 19v-4.5M11 19v-8.5M17 19v-12"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="17" cy="4.6" r="1.9" fill="currentColor" />
              </svg>
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight text-ink">
                Physio Tracker
              </span>
              <span className="mt-0.5 hidden text-[11px] font-medium text-faint sm:block">
                Hip rehab
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden sm:block">
            <ul className="flex items-center gap-1">
              {LINKS.map(({ href, label }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`focus-ring relative flex h-9 items-center rounded-lg px-3
                        text-sm font-medium transition ${
                          active ? 'text-ink' : 'text-muted hover:bg-panel hover:text-ink'
                        }`}
                    >
                      {label}
                      {/* Underline sits outside the text flow so nothing shifts. */}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full
                          bg-accent transition-all duration-200 ${
                            active ? 'opacity-100' : 'scale-x-0 opacity-0'
                          }`}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </div>
      </header>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line
          bg-surface/95 backdrop-blur-md sm:hidden"
      >
        <ul className="mx-auto flex max-w-4xl">
          {LINKS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`focus-ring relative flex flex-col items-center gap-0.5 px-2 pb-2 pt-2.5
                    text-[11px] font-semibold transition ${
                      active ? 'text-accent' : 'text-muted'
                    }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-6 top-0 h-0.5 rounded-full bg-accent
                      transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
