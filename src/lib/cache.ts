import { getTimestamp } from './time';

export const cacheGet = (key: string): string | null => {
  let valueWithExpires = localStorage.getItem(key);
  if (!valueWithExpires) return null;
  let valueArr = valueWithExpires.split(':');
  if (!valueArr || valueArr.length < 2) return valueWithExpires;
  const expiresAt = Number(valueArr[0]);
  const currTimestamp = getTimestamp();
  if (expiresAt > 0 && expiresAt < currTimestamp) {
    cacheRemove(key);
    return null;
  }
  const searchStr = valueArr[0] + ':';
  return valueWithExpires.replace(searchStr, '');
};

export const cacheSet = (key: string, value: string, expiresAt: number = 0) => {
  if (!expiresAt) {
    localStorage.setItem(key, value);
    return;
  }
  localStorage.setItem(key, expiresAt + ':' + value);
};

export const cacheRemove = (key: string) => {
  localStorage.removeItem(key);
};

export const cacheClear = () => {
  localStorage.clear();
};
