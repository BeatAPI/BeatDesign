import { Check, ChevronDown, Globe2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  localeNames,
  normalizeLocale,
  supportedLocales,
} from '@/config/locale';
import { m } from '@/paraglide/messages.js';
import { getLocale, setLocale } from '@/paraglide/runtime.js';

type LanguageSwitcherProps = {
  variant?: 'marketing' | 'workspace';
};

export function LanguageSwitcher({
  variant = 'marketing',
}: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const locale = normalizeLocale(getLocale());
  const switchLanguageLabel = m['product.shell.switchLanguage'](
    {},
    { locale }
  );

  useEffect(() => {
    if (!open) return;

    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function switchLanguage(nextLocale: (typeof supportedLocales)[number]) {
    setOpen(false);
    if (nextLocale !== locale) setLocale(nextLocale);
  }

  const workspace = variant === 'workspace';

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={switchLanguageLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        title={switchLanguageLabel}
        onClick={() => setOpen((value) => !value)}
        className={
          workspace
            ? 'inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.035] px-2.5 text-xs font-medium text-[var(--beat-text-2)] transition hover:border-white/[0.16] hover:bg-white/[0.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--beat-graph)]/70'
            : 'inline-flex h-8 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-white/45 transition hover:bg-white/[0.06] hover:text-white'
        }
      >
        <Globe2 className="size-3.5" aria-hidden="true" />
        {locale.toUpperCase()}
        <ChevronDown
          aria-hidden="true"
          className={`size-3 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={switchLanguageLabel}
          className="absolute right-0 top-full z-50 mt-2 min-w-[140px] overflow-hidden rounded-[12px] border border-white/[0.08] bg-[#151517] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          {supportedLocales.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === locale}
              onClick={() => switchLanguage(option)}
              className={`flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-[13px] transition hover:bg-white/[0.06] ${
                option === locale
                  ? 'text-white'
                  : 'text-[var(--beat-text-2)] hover:text-white'
              }`}
            >
              {localeNames[option]}
              {option === locale ? (
                <Check
                  className="size-3.5 text-[var(--beat-accent)]"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
