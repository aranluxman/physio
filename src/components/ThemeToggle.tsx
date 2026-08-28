'use client';

import { useTheme, type ThemePreference } from '@/hooks/useTheme';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

/** Single button that flips light <-> dark. Used in the top nav. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle, mounted } = useTheme();
  // Until mounted, the server render and the client must agree, so the label
  // stays generic for one frame rather than guessing the current theme.
  const label = mounted
    ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`
    : 'Toggle dark mode';

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={mounted ? theme === 'dark' : undefined}
      className={`focus-ring relative flex h-9 w-9 items-center justify-center rounded-xl
        border border-line bg-surface text-muted transition
        hover:border-accent/40 hover:text-accent ${className}`}
    >
      {/* Both icons stay mounted and cross-fade, so the swap has no flicker. */}
      <SunIcon
        className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
          theme === 'dark' ? 'scale-50 opacity-0 -rotate-90' : 'scale-100 opacity-100 rotate-0'
        }`}
      />
      <MoonIcon
        className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
          theme === 'dark' ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 rotate-90'
        }`}
      />
    </button>
  );
}

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: MonitorIcon },
];

/** Three-way segmented control, for the profile menu and settings page. */
export function ThemeSegmented({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`grid grid-cols-3 gap-1 rounded-xl bg-panel p-1 ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={`focus-ring flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5
              text-xs font-semibold transition ${
                active
                  ? 'bg-surface text-ink shadow-card'
                  : 'text-muted hover:text-ink'
              }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
