/** Localize errors produced by the local model contract; preserve provider errors verbatim. */
export function localizeModelError(message: string, translate: (key: string) => string): string {
  if (/images cannot be combined with video or audio references/i.test(message)) return translate('messages.mixedModelReferences');
  if (/Kling 4 frame mode is not yet supported/i.test(message)) return translate('messages.kling4Frames');
  if (/^Unsupported (aspect_ratio|wmDuration|wmOutputQuality|mode|quality) for model /i.test(message)) return translate('messages.unsupportedModelParameter');
  if (/Qwen Image 2\.1 seed must not exceed/i.test(message)) return translate('messages.invalidQwenSeed');
  return message;
}
