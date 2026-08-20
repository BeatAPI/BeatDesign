import {
  getRegisteredEffectById,
  getRegisteredEffectsByIds,
} from './registered-effects';

export const getEffectById = async (id: number) =>
  getRegisteredEffectById(id);

export const getEffectsByIds = async (ids: number[]) =>
  getRegisteredEffectsByIds(ids);
