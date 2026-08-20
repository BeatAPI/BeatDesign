import type { EffectMetadata } from '@/core/effects/client-api';

export const buildEffectMetadataMap = (payload: {
  effects?: Record<string, EffectMetadata>;
}) =>
  Object.values(payload.effects ?? {}).reduce<Record<number, EffectMetadata>>(
    (accumulator, item) => {
      accumulator[item.id] = item;
      return accumulator;
    },
    {}
  );

export const getDraftUploadFailureMessage = ({
  error,
  fallbackMessage,
}: {
  error: unknown;
  fallbackMessage: string;
}) =>
  error instanceof Error && error.message ? error.message : fallbackMessage;
