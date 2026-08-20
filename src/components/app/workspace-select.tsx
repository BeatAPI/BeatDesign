'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import {
  composerFieldButtonClassName,
  getComposerOptionRowClassName,
} from '@/components/app/composer-styles';
import { cn } from '@/lib/utils';

export type WorkspaceSelectOption = {
  value: string;
  label: string;
  /** Optional leading mark: model icon, media glyph, ratio preview… */
  leading?: ReactNode;
};

/**
 * Pill-shaped dropdown that matches the composer chip language. Replaces
 * native <select> so the open menu shares the workspace visual system.
 *
 * The menu is portaled to <body> with fixed coordinates because composer
 * shells clip their overflow — an absolutely-positioned menu would be cut
 * off at the card edge when it opens upward.
 */
export function WorkspaceSelect({
  value,
  options,
  onChange,
  ariaLabel,
  leadingIcon,
  triggerClassName,
}: {
  value: string;
  options: WorkspaceSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  /** Icon shown on the trigger when the selected option has none. */
  leadingIcon?: ReactNode;
  /** Extra trigger classes, e.g. a per-type fixed width. */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    bottom: number;
    minWidth: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected =
    options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) return;
    function closeMenu(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function closeOnKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    function positionMenu() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        left: rect.left,
        // 8px above the trigger, opening upward.
        bottom: window.innerHeight - rect.top + 8,
        minWidth: Math.max(170, rect.width),
      });
    }
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, { capture: true });
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, { capture: true });
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        className={cn(
          composerFieldButtonClassName,
          'justify-center px-2.5',
          triggerClassName
        )}
      >
        {selected?.leading ?? leadingIcon}
        <span className="min-w-0 truncate text-left">{selected?.label}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                left: menuPosition.left,
                bottom: menuPosition.bottom,
                minWidth: menuPosition.minWidth,
              }}
              className="beat-pop-in z-[70] max-h-[264px] origin-bottom overflow-y-auto rounded-[var(--beat-radius-sm)] border border-white/10 bg-[var(--beat-surface-2)] p-1.5 text-[var(--beat-text-1)] shadow-[0_24px_64px_rgba(0,0,0,0.55),0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]"
              role="listbox"
              aria-label={ariaLabel}
            >
              {options.map((option) => {
                const isSelected = option.value === selected?.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={getComposerOptionRowClassName(isSelected)}
                  >
                    {option.leading}
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    {isSelected ? (
                      <Check className="size-3.5 shrink-0 text-[var(--beat-accent)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
