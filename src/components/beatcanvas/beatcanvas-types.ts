'use client';

export type StudioTranslateFn = (
  key: string,
  values?: Record<string, string | number>
) => string;
