export type StudioHistoryMediaOrientation =
  | 'portrait'
  | 'landscape'
  | 'square';

export type StudioHistoryMediaFrame = {
  aspectRatio: string;
  orientation: StudioHistoryMediaOrientation;
};

const pad = (value: number) => String(value).padStart(2, '0');

export function formatStudioHistoryDateTime(date: Date) {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getStudioHistoryMediaFrame(
  aspectRatio: string | null,
  natural?: { width: number; height: number } | null
): StudioHistoryMediaFrame {
  const match = aspectRatio?.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  const width = natural?.width || (match ? Number(match[1]) : 16);
  const height = natural?.height || (match ? Number(match[2]) : 9);
  const ratio = width / height;

  return {
    aspectRatio: `${width} / ${height}`,
    orientation:
      ratio < 0.95 ? 'portrait' : ratio > 1.05 ? 'landscape' : 'square',
  };
}
