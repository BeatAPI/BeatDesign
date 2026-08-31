import { useState } from 'react';

import { cn } from '@/lib/utils';

type StudioStartHereIdea = {
  className: string;
  src: string;
  title: string;
};

const STUDIO_START_HERE_IDEAS: StudioStartHereIdea[] = [
  {
    className:
      'left-0 top-[18px] size-[90px] rotate-[-8deg] rounded-[14px] sm:left-[22px] sm:top-[14px] sm:size-[132px]',
    src: '/app/create-thumb-forest.webp',
    title: 'Cinematic landscape',
  },
  {
    className:
      'left-[82px] top-[2px] size-[102px] rotate-[3deg] rounded-[17px] sm:left-[134px] sm:top-0 sm:size-[132px]',
    src: '/app/create-thumb-character.webp',
    title: 'Editorial character',
  },
  {
    className:
      'left-[172px] top-[10px] size-[96px] rounded-full sm:left-[250px] sm:top-[4px] sm:size-[126px]',
    src: '/app/create-thumb-texture.webp',
    title: 'Material study',
  },
  {
    className:
      'right-0 top-[16px] size-[98px] rotate-[6deg] rounded-[14px] sm:right-[6px] sm:top-[12px] sm:size-[128px]',
    src: '/app/create-thumb-mask.webp',
    title: 'Surreal fashion film',
  },
];

export function StudioStartHere() {
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);

  return (
    <div className="pointer-events-auto w-[min(94vw,620px)] text-center">
      <div
        aria-label="Starting ideas"
        className="relative mx-auto h-[122px] w-[min(88vw,350px)] sm:h-[148px] sm:w-[500px]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-45 blur-[42px]">
          {STUDIO_START_HERE_IDEAS.map((idea) => (
            <img
              key={`glow-${idea.src}`}
              src={idea.src}
              alt=""
              className={`absolute border-[6px] border-[#6b6b72]/75 object-cover shadow-[0_18px_52px_rgba(0,0,0,0.45)] ${idea.className}`}
            />
          ))}
        </div>

        {STUDIO_START_HERE_IDEAS.map((idea) => {
          const isSelected = selectedSrc === idea.src;
          const hasSelection = selectedSrc !== null;

          return (
            <button
              key={idea.src}
              type="button"
              title={idea.title}
              aria-label={`Select ${idea.title}`}
              aria-pressed={isSelected}
              onClick={() => setSelectedSrc(idea.src)}
              className={cn(
                'group absolute overflow-hidden border-[6px] border-[#6b6b72]/85 bg-[#141416] object-cover shadow-[0_18px_48px_rgba(0,0,0,0.4)] transition-[transform,border-color,filter,box-shadow,opacity] duration-300 ease-out hover:z-20 hover:scale-[1.045] hover:border-white/65 hover:brightness-100 hover:opacity-100 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a33]',
                idea.className,
                isSelected &&
                  'z-20 scale-[1.06] border-white/85 brightness-[1.14] shadow-[0_24px_62px_rgba(0,0,0,0.58),0_0_0_2px_rgba(255,255,255,0.12)]',
                hasSelection && !isSelected && 'brightness-[0.72] opacity-70'
              )}
            >
              <img
                src={idea.src}
                alt=""
                className={cn(
                  'h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105',
                  isSelected && 'scale-105'
                )}
              />
            </button>
          );
        })}
      </div>
      <h1 className="mt-7 text-[1.7rem] font-semibold leading-none tracking-[-0.035em] text-white sm:text-[2.15rem]">
        Create Here
      </h1>
      <p className="mx-auto mt-3 max-w-[390px] text-[13px] leading-6 text-white/35 sm:text-sm">
        Imagine the scene. Shape the mood. Bring it to life.
      </p>
    </div>
  );
}
