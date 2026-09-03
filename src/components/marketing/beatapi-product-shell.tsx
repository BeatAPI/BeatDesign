import {
  Menu,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { LanguageSwitcher } from '@/components/app/language-switcher';
import { normalizeLocale } from '@/config/locale';
import { Link } from '@/core/i18n/navigation';
import { appConfig } from '@/config';
import { m } from '@/paraglide/messages.js';

type ProductSurface = 'home' | 'projects';

function getShellCopy(locale: string) {
  const messageLocale = normalizeLocale(locale);
  return {
    home: m['product.shell.home']({}, { locale: messageLocale }),
    create: m['product.shell.create']({}, { locale: messageLocale }),
    projects: m['product.shell.projects']({}, { locale: messageLocale }),
    openNavigation: m['product.shell.openNavigation'](
      {},
      { locale: messageLocale }
    ),
    closeNavigation: m['product.shell.closeNavigation'](
      {},
      { locale: messageLocale }
    ),
    switchLanguage: m['product.shell.switchLanguage'](
      {},
      { locale: messageLocale }
    ),
    terms: m['product.shell.terms']({}, { locale: messageLocale }),
    privacy: m['product.shell.privacy']({}, { locale: messageLocale }),
  };
}

type ShellCopy = ReturnType<typeof getShellCopy>;

function getNavItems(copy: ShellCopy) {
  return [
    { label: copy.home, href: '/' },
    { label: copy.create, href: '/studio' },
    { label: copy.projects, href: '/projects' },
  ] as const;
}

const activeNavHref: Record<ProductSurface, string> = {
  home: '/',
  projects: '/projects',
};

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label={`${appConfig.app_name} home`}
      className="beat-product-display inline-flex min-w-0 items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] text-[#f6f6f4] sm:text-base"
    >
      <img
        src={appConfig.app_logo}
        alt=""
        className="size-7 shrink-0 rounded-[9px] object-contain"
      />
      <span className="truncate">{appConfig.app_name}</span>
    </Link>
  );
}

function CapsuleNav({
  active,
  items,
}: {
  active: ProductSurface;
  items: ReturnType<typeof getNavItems>;
}) {
  const activeHref = activeNavHref[active];
  return (
    <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 text-sm font-medium md:flex lg:gap-8">
      {items.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive
                ? 'text-white'
                : 'text-white/45 transition-colors hover:text-white'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BeatApiProductShell({
  active,
  locale,
  children,
}: {
  active: ProductSurface;
  locale: string;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentLocale = normalizeLocale(locale);
  const copy = getShellCopy(currentLocale);
  const navItems = getNavItems(copy);

  return (
    <div
      lang={currentLocale}
      className="beat-product-shell min-h-[100dvh] bg-[var(--beat-bg)] pt-4 text-[#f4f4f5] selection:bg-[#ff7a33]/35 sm:pt-5"
    >
      <header className="sticky top-3 z-40 px-4 sm:top-4 sm:px-6">
        <div className="mx-auto flex h-[60px] w-full min-w-0 max-w-[1280px] items-center gap-3 rounded-full border border-white/[0.08] bg-[#131416]/90 px-3.5 shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:px-5">
          <Brand />

          <CapsuleNav active={active} items={navItems} />

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>

            <button
              type="button"
              aria-label={
                menuOpen ? copy.closeNavigation : copy.openNavigation
              }
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-white transition hover:border-white/20 md:hidden"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="absolute inset-x-4 top-[calc(100%+8px)] rounded-[18px] border border-white/10 bg-[#111113]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-[12px] px-4 py-3 text-sm font-medium text-[#d4d4d8] hover:bg-white/[0.06] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-white/10 px-2 pt-3">
              <span className="text-[11px] font-medium text-[#77777e]">
                {copy.switchLanguage}
              </span>
              <LanguageSwitcher />
            </div>
          </div>
        ) : null}
      </header>

      {children}

      <footer className="px-5 pb-8 pt-16 text-center text-[11px] font-[500] text-[#626269]">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/terms-of-service" className="transition hover:text-[#b6b6bb]">
            {copy.terms}
          </Link>
          <Link href="/privacy-policy" className="transition hover:text-[#b6b6bb]">
            {copy.privacy}
          </Link>
        </div>
      </footer>
    </div>
  );
}
