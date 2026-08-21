export function maskApiKeyPreview(value: string): string {
  const key = value.trim();
  if (!key) return '';
  if (key.length <= 8) return `${key.slice(0, Math.min(4, key.length))}...`;
  return `${key.slice(0, 12)}...`;
}
