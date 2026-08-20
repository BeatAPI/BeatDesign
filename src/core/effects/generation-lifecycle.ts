export type GenerationInternalStatus =
  | 'queued'
  | 'submitting'
  | 'submitted'
  | 'processing'
  | 'finalizing'
  | 'succeeded'
  | 'failed'
  | 'timed_out';

export type GenerationPublicStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

export const getPublicGenerationStatus = (
  status: GenerationInternalStatus
): GenerationPublicStatus => {
  switch (status) {
    case 'queued':
    case 'submitting':
      return 'pending';
    case 'submitted':
    case 'processing':
    case 'finalizing':
      return 'processing';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
    case 'timed_out':
      return 'failed';
  }
};

export const isTerminalGenerationStatus = (status: GenerationInternalStatus) =>
  status === 'succeeded' || status === 'failed' || status === 'timed_out';
