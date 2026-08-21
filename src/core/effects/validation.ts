import {
  AVATAR_MAX_FILE_SIZE,
  REFERENCE_AUDIO_MAX_FILE_SIZE,
  REFERENCE_IMAGE_MAX_FILE_SIZE,
  REFERENCE_VIDEO_MAX_FILE_SIZE,
} from '@/core/workspace-lib/constants';

export const MAX_GENERATION_PROMPT_CHARS = 2000;
export const GPT_IMAGE_2_GENERATION_PROMPT_CHARS = 6000;
const GPT_IMAGE_2_MODEL_ID = 'gpt-image-2';
const GPT_IMAGE_2_PROVIDERS = new Set(['beatapi']);

export type GenerationValidationCode =
  | 'PROMPT_REQUIRED'
  | 'PROMPT_TOO_LONG'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_TYPE_UNSUPPORTED'
  | 'VIDEO_TOO_LARGE'
  | 'VIDEO_TYPE_UNSUPPORTED'
  | 'AUDIO_TOO_LARGE'
  | 'AUDIO_TYPE_UNSUPPORTED';

type PromptValidationSuccess = {
  ok: true;
  trimmedPrompt: string;
  charCount: number;
};

type PromptValidationFailure = {
  ok: false;
  code: 'PROMPT_REQUIRED' | 'PROMPT_TOO_LONG';
  trimmedPrompt: string;
  charCount: number;
  maxChars: number;
};

type UploadedImageValidationSuccess = {
  ok: true;
};

type UploadedImageValidationFailure = {
  ok: false;
  code: 'IMAGE_TOO_LARGE' | 'IMAGE_TYPE_UNSUPPORTED';
  maxBytes: number;
  allowedTypes?: readonly string[];
};

type UploadedVideoValidationSuccess = {
  ok: true;
};

type UploadedVideoValidationFailure = {
  ok: false;
  code: 'VIDEO_TOO_LARGE' | 'VIDEO_TYPE_UNSUPPORTED';
  maxBytes: number;
  allowedTypes?: readonly string[];
};

type UploadedAudioValidationSuccess = {
  ok: true;
};

type UploadedAudioValidationFailure = {
  ok: false;
  code: 'AUDIO_TOO_LARGE' | 'AUDIO_TYPE_UNSUPPORTED';
  maxBytes: number;
  allowedTypes?: readonly string[];
};

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
] as const;

const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;
const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
] as const;

export {
  AVATAR_MAX_FILE_SIZE,
  REFERENCE_AUDIO_MAX_FILE_SIZE,
  REFERENCE_IMAGE_MAX_FILE_SIZE,
  REFERENCE_VIDEO_MAX_FILE_SIZE,
};

const getNormalizedMimeType = (fileType: string) =>
  fileType.trim().toLowerCase();

const hasAllowedImageExtension = (fileName?: string) =>
  Boolean(fileName && /\.(jpe?g|png|webp)$/i.test(fileName));

const hasAllowedVideoExtension = (fileName?: string) =>
  Boolean(fileName && /\.(mp4|webm|mov)$/i.test(fileName));

export type UploadedMediaType = 'image' | 'video';

export const detectUploadedMediaType = (file: {
  type: string;
  name?: string;
}): UploadedMediaType | null => {
  const mimeType = getNormalizedMimeType(file.type);

  if (
    ALLOWED_IMAGE_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
    ) ||
    hasAllowedImageExtension(file.name)
  ) {
    return 'image';
  }

  if (
    ALLOWED_VIDEO_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_VIDEO_MIME_TYPES)[number]
    ) ||
    hasAllowedVideoExtension(file.name)
  ) {
    return 'video';
  }

  return null;
};

export const countPromptCharacters = (prompt: string) =>
  Array.from(prompt).length;

export const truncatePromptToMaxChars = (
  prompt: string,
  maxChars = MAX_GENERATION_PROMPT_CHARS
) => Array.from(prompt).slice(0, maxChars).join('');

export const getGenerationPromptMaxChars = ({
  modelId,
  provider,
}: {
  modelId?: string | null;
  provider?: string | null;
} = {}) =>
  modelId === GPT_IMAGE_2_MODEL_ID ||
  (provider ? GPT_IMAGE_2_PROVIDERS.has(provider) : false)
    ? GPT_IMAGE_2_GENERATION_PROMPT_CHARS
    : MAX_GENERATION_PROMPT_CHARS;

export const validateGenerationPrompt = (
  prompt: string,
  options?: {
    required?: boolean;
    maxChars?: number;
  }
): PromptValidationSuccess | PromptValidationFailure => {
  const required = options?.required ?? true;
  const maxChars = options?.maxChars ?? MAX_GENERATION_PROMPT_CHARS;
  const trimmedPrompt = prompt.trim();
  const charCount = countPromptCharacters(trimmedPrompt);

  if (!trimmedPrompt && required) {
    return {
      ok: false,
      code: 'PROMPT_REQUIRED',
      trimmedPrompt,
      charCount,
      maxChars,
    };
  }

  if (charCount > maxChars) {
    return {
      ok: false,
      code: 'PROMPT_TOO_LONG',
      trimmedPrompt,
      charCount,
      maxChars,
    };
  }

  return {
    ok: true,
    trimmedPrompt,
    charCount,
  };
};

export const validateUploadedImageFile = (file: {
  size: number;
  type: string;
  name?: string;
}): UploadedImageValidationSuccess | UploadedImageValidationFailure => {
  if (file.size > REFERENCE_IMAGE_MAX_FILE_SIZE) {
    return {
      ok: false,
      code: 'IMAGE_TOO_LARGE',
      maxBytes: REFERENCE_IMAGE_MAX_FILE_SIZE,
    };
  }

  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      getNormalizedMimeType(
        file.type
      ) as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
    ) &&
    !hasAllowedImageExtension(file.name)
  ) {
    return {
      ok: false,
      code: 'IMAGE_TYPE_UNSUPPORTED',
      maxBytes: REFERENCE_IMAGE_MAX_FILE_SIZE,
      allowedTypes: ALLOWED_IMAGE_MIME_TYPES,
    };
  }

  return { ok: true };
};

export const validateUploadedVideoFile = (file: {
  size: number;
  type: string;
  name?: string;
}): UploadedVideoValidationSuccess | UploadedVideoValidationFailure => {
  if (file.size > REFERENCE_VIDEO_MAX_FILE_SIZE) {
    return {
      ok: false,
      code: 'VIDEO_TOO_LARGE',
      maxBytes: REFERENCE_VIDEO_MAX_FILE_SIZE,
    };
  }

  if (
    !ALLOWED_VIDEO_MIME_TYPES.includes(
      getNormalizedMimeType(
        file.type
      ) as (typeof ALLOWED_VIDEO_MIME_TYPES)[number]
    ) &&
    !hasAllowedVideoExtension(file.name)
  ) {
    return {
      ok: false,
      code: 'VIDEO_TYPE_UNSUPPORTED',
      maxBytes: REFERENCE_VIDEO_MAX_FILE_SIZE,
      allowedTypes: ALLOWED_VIDEO_MIME_TYPES,
    };
  }

  return { ok: true };
};

export const validateUploadedAudioFile = (file: {
  size: number;
  type: string;
}): UploadedAudioValidationSuccess | UploadedAudioValidationFailure => {
  if (file.size > REFERENCE_AUDIO_MAX_FILE_SIZE) {
    return {
      ok: false,
      code: 'AUDIO_TOO_LARGE',
      maxBytes: REFERENCE_AUDIO_MAX_FILE_SIZE,
    };
  }

  if (
    !ALLOWED_AUDIO_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_AUDIO_MIME_TYPES)[number]
    )
  ) {
    return {
      ok: false,
      code: 'AUDIO_TYPE_UNSUPPORTED',
      maxBytes: REFERENCE_AUDIO_MAX_FILE_SIZE,
      allowedTypes: ALLOWED_AUDIO_MIME_TYPES,
    };
  }

  return { ok: true };
};

export const validateAvatarFile = (file: {
  size: number;
  type: string;
}): UploadedImageValidationSuccess | UploadedImageValidationFailure => {
  if (file.size > AVATAR_MAX_FILE_SIZE) {
    return {
      ok: false,
      code: 'IMAGE_TOO_LARGE',
      maxBytes: AVATAR_MAX_FILE_SIZE,
    };
  }

  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
    )
  ) {
    return {
      ok: false,
      code: 'IMAGE_TYPE_UNSUPPORTED',
      maxBytes: AVATAR_MAX_FILE_SIZE,
      allowedTypes: ALLOWED_IMAGE_MIME_TYPES,
    };
  }

  return { ok: true };
};

export const generationValidationConstraints = {
  maxPromptChars: MAX_GENERATION_PROMPT_CHARS,
  maxImageFileBytes: REFERENCE_IMAGE_MAX_FILE_SIZE,
  allowedImageMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
  maxVideoFileBytes: REFERENCE_VIDEO_MAX_FILE_SIZE,
  allowedVideoMimeTypes: ALLOWED_VIDEO_MIME_TYPES,
  maxAudioFileBytes: REFERENCE_AUDIO_MAX_FILE_SIZE,
  allowedAudioMimeTypes: ALLOWED_AUDIO_MIME_TYPES,
  maxAvatarFileBytes: AVATAR_MAX_FILE_SIZE,
} as const;
