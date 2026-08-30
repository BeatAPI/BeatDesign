import {
  getRegisteredEffectById,
  getRegisteredEffectsByIds,
} from './registered-effects';

export const getEffectById = async (id: number, providerId?: string) =>
  getRegisteredEffectById(id, providerId);

export const getEffectsByIds = async (ids: number[]) =>
  getRegisteredEffectsByIds(ids);
