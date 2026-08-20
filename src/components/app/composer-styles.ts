import { cn } from '@/lib/utils';

/*
 * Shared BeatAPI composer vocabulary — the single source for the Studio
 * composer and the Canvas composer. Everything references the --beat-* dark
 * product tokens (see globals.css) so both surfaces stay in lockstep with
 * the marketing design language:
 *   - orange (--beat-accent) is reserved for the Generate action
 *   - surfaces are the 145deg #1b1b1e→#151517 card recipe + inset highlight
 *   - text uses the beat three-level ink scale
 * Control row is deliberately compact (32px chips): the composer's weight
 * lives in the prompt, not the controls.
 */

/** Composer card surface — mirrors the homepage hero composer card. */
export const composerCardClassName =
  'rounded-[var(--beat-radius)] border border-white/[0.13] bg-[linear-gradient(145deg,rgba(27,27,30,0.97)_0%,rgba(21,21,23,0.97)_100%)] shadow-[0_32px_100px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-2xl';

/** Field trigger chip (model / ratio / quality selectors). */
export const composerFieldButtonClassName =
  'relative flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.035] px-2 text-left text-[12px] font-medium text-[var(--beat-text-1)] transition-all duration-200 hover:border-white/[0.18] hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--beat-graph)] disabled:cursor-not-allowed disabled:opacity-60';

/** Floating picker panel anchored above a field chip. */
export const composerFloatingPanelClassName =
  'beat-pop-in absolute bottom-[calc(100%+8px)] z-40 max-h-[min(360px,60vh)] overflow-y-auto rounded-[var(--beat-radius-sm)] border border-white/10 bg-[var(--beat-surface-2)] p-1.5 text-[var(--beat-text-1)] shadow-[0_24px_64px_rgba(0,0,0,0.55),0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]';

/** Option row inside a floating picker panel. */
export const getComposerOptionRowClassName = (isSelected: boolean) =>
  cn(
    'flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12px] transition-colors duration-150',
    isSelected
      ? 'bg-white/[0.09] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
      : 'text-[var(--beat-text-2)] hover:bg-white/[0.06] hover:text-white'
  );

/** Quiet Figtree section label — same voice as product UI, not dashboard caps. */
export const beatPanelLabelClassName =
  'text-[12px] font-medium tracking-[-0.01em] text-[var(--beat-text-2)]';

/** Section label inside a floating picker panel. */
export const composerSectionLabelClassName = `px-0.5 ${beatPanelLabelClassName}`;

/** Parameter value chip inside a picker panel. */
export const getComposerParameterChipClassName = (isActive: boolean) =>
  cn(
    'rounded-full border px-2.5 py-1.5 text-[12px] font-medium tracking-[-0.01em] transition-all duration-150',
    isActive
      ? 'border-white/[0.16] bg-white/[0.10] text-[var(--beat-text-1)]'
      : 'border-white/[0.08] bg-white/[0.03] text-[var(--beat-text-2)] hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-[var(--beat-text-1)]'
  );

/** Circular Generate action — the one orange element in the composer. */
export const composerGenerateButtonClassName =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--beat-accent)] text-[var(--beat-accent-ink)] shadow-[0_6px_18px_rgba(255,122,51,0.28)] transition hover:bg-[var(--beat-accent-hover)] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25 disabled:shadow-none';
