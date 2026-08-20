export type EffectsQueueSource = 'generate' | 'retry';
export type EffectsStatusCheckMessage = {
  wmTaskId: string;
  effectId: number;
  attempt: number;
  source: EffectsQueueSource;
};

export async function enqueueEffectsStatusCheck(
  _message: EffectsStatusCheckMessage
) {
  return { enqueued: false, reason: 'In-process polling is active' };
}
