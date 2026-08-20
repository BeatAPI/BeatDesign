const startsWithBytes = (bytes: Uint8Array, signature: number[]) =>
  signature.every((value, index) => bytes[index] === value);

const asciiAt = (bytes: Uint8Array, offset: number, value: string) =>
  [...value].every((character, index) =>
    bytes[offset + index] === character.charCodeAt(0)
  );

const hasIsoImageBrand = (bytes: Uint8Array) => {
  if (bytes.length < 12 || !asciiAt(bytes, 4, 'ftyp')) return false;
  const header = new TextDecoder('ascii').decode(bytes.slice(8, 40));
  return /(?:avif|avis|heic|heix|hevc|hevx|mif1|msf1)/.test(header);
};

export function isSupportedRasterImage(
  mimeType: string,
  bytes: Uint8Array
): boolean {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWithBytes(bytes, [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
    case 'image/gif':
      return asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a');
    case 'image/webp':
      return asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP');
    case 'image/avif':
    case 'image/heic':
    case 'image/heif':
      return hasIsoImageBrand(bytes);
    default:
      return false;
  }
}
