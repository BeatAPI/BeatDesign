import {
  ArrowRight,
  ArrowUp,
  Film,
  FolderClock,
  ImagePlus,
  PanelsTopLeft,
  Workflow,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Link } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';
import { BeatApiProductShell } from './beatapi-product-shell';

function getCopy(locale: string) {
  const messageLocale = locale === 'zh' ? 'zh' : 'en';
  return {
    eyebrow: m['product.home.eyebrow']({}, { locale: messageLocale }),
    titleLine1: m['product.home.titleLine1']({}, { locale: messageLocale }),
    titleLine2: m['product.home.titleLine2']({}, { locale: messageLocale }),
    prompt: m['product.home.prompt']({}, { locale: messageLocale }),
    sectionTitle: m['product.home.sectionTitle']({}, { locale: messageLocale }),
    projects: m['product.home.viewProjects']({}, { locale: messageLocale }),
    studioDescription: m['product.home.studioDescription'](
      {},
      { locale: messageLocale }
    ),
    canvasDescription: m['product.home.canvasDescription'](
      {},
      { locale: messageLocale }
    ),
    projectsTitle: m['product.home.projectsTitle'](
      {},
      { locale: messageLocale }
    ),
    projectsDescription: m['product.home.projectsDescription'](
      {},
      { locale: messageLocale }
    ),
    open: m['product.home.openWorkspace']({}, { locale: messageLocale }),
    createInStudio: m['product.home.createInStudio'](
      {},
      { locale: messageLocale }
    ),
    mediaImage: m['product.home.mediaImage']({}, { locale: messageLocale }),
    mediaVideo: m['product.home.mediaVideo']({}, { locale: messageLocale }),
  };
}

type HomeCopy = ReturnType<typeof getCopy>;

function WorkspaceCard({
  title,
  index,
  description,
  href,
  icon,
  openLabel,
}: {
  title: string;
  index: string;
  description: string;
  href: string;
  icon: ReactNode;
  openLabel: string;
}) {
  return (
    <Link href={href} className="group block h-full">
      <article className="relative flex h-full min-h-[212px] flex-col overflow-hidden rounded-[var(--beat-radius)] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.045]">
        <div className="flex items-start justify-between">
          <span className="grid size-10 place-items-center rounded-[var(--beat-radius-sm)] border border-white/[0.06] bg-[#111113] text-[var(--beat-accent)] transition-shadow duration-300 group-hover:shadow-[0_0_28px_rgba(255,122,51,0.2)]">
            {icon}
          </span>
          <span className="beat-product-display text-[11px] font-semibold tracking-[0.14em] text-white/25">
            {index}
          </span>
        </div>
        <h3 className="beat-product-display mt-6 text-[17px] font-semibold tracking-[-0.02em] text-[var(--beat-text-1)]">
          {title}
        </h3>
        <p className="mt-2 max-w-[330px] text-[13px] leading-[1.65] text-[var(--beat-text-2)]">
          {description}
        </p>
        <span className="mt-auto inline-flex items-center gap-2 pt-6 text-[12.5px] font-medium text-white/65 transition-colors group-hover:text-white">
          {openLabel}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </article>
    </Link>
  );
}

function PromptComposer({ copy }: { copy: HomeCopy }) {
  const [prompt, setPrompt] = useState('');
  const mediaActions = [
    { label: copy.mediaImage, icon: ImagePlus },
    { label: copy.mediaVideo, icon: Film },
  ] as const;

  return (
    <form
      action="/studio"
      method="get"
      className="mx-auto mt-10 flex min-h-[160px] w-full max-w-[720px] flex-col rounded-[var(--beat-radius)] border border-white/[0.13] bg-[linear-gradient(145deg,#1b1b1e_0%,#151517_100%)] p-5 text-left shadow-[0_30px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.035)] sm:p-6"
    >
      <textarea
        name="prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={copy.prompt}
        aria-label={copy.prompt}
        className="min-h-16 w-full resize-none border-0 bg-transparent text-[15px] leading-6 text-white outline-none placeholder:text-[var(--beat-text-3)] sm:text-base"
      />
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {mediaActions.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => setPrompt((value) => value || `${label}: `)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3 text-xs font-medium text-[var(--beat-text-2)] transition hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white"
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          aria-label={copy.createInStudio}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--beat-accent)] text-[var(--beat-accent-ink)] shadow-[0_8px_24px_rgba(255,122,51,0.3)] transition hover:scale-[1.04] hover:bg-[#ff8a4d]"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
    </form>
  );
}

export function BeatApiProductHome({ locale }: { locale: string }) {
  const copy = getCopy(locale);
  const titleLines = [copy.titleLine1, copy.titleLine2];

  return (
    <BeatApiProductShell active="home" locale={locale}>
      <main className="mx-auto w-full max-w-[1280px] px-5 sm:px-6">
        <section className="beat-product-hero pb-14 pt-[64px] text-center sm:pt-[84px] lg:pb-[72px]">
          <p className="beat-product-display inline-flex items-center gap-2.5 text-[10px] font-semibold tracking-[0.18em] text-[var(--beat-accent)] sm:text-[11px]">
            <span className="size-1.5 rounded-full bg-[var(--beat-accent)]" />
            {copy.eyebrow}
          </p>
          <h1 className="beat-product-display beat-product-hero-title mx-auto mt-6 w-full max-w-[720px] text-[clamp(2.25rem,6.6vw,4.75rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-[#f7f7f8]">
            {titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <PromptComposer copy={copy} />
        </section>

        <section className="pb-14">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="beat-product-display text-xl font-semibold tracking-[-0.03em] text-[var(--beat-text-1)] sm:text-[22px]">
              {copy.sectionTitle}
            </h2>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--beat-text-2)] transition hover:text-white"
            >
              {copy.projects}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <WorkspaceCard
              title="Studio"
              index="01"
              description={copy.studioDescription}
              href="/studio"
              icon={<PanelsTopLeft className="size-5" />}
              openLabel={copy.open}
            />
            <WorkspaceCard
              title="Canvas"
              index="02"
              description={copy.canvasDescription}
              href="/canvas"
              icon={<Workflow className="size-5" />}
              openLabel={copy.open}
            />
            <WorkspaceCard
              title={copy.projectsTitle}
              index="03"
              description={copy.projectsDescription}
              href="/projects"
              icon={<FolderClock className="size-5" />}
              openLabel={copy.open}
            />
          </div>
        </section>
      </main>
    </BeatApiProductShell>
  );
}
