export type EffectRecord = {
  id: number;
  name: string;
  type: number;
  model: string;
  version: string | null;
  linkName: string;
  description: string | null;
  platform: string | null;
  api: string | null;
  provider: string;
  inputSchema: unknown;
};

export type GenerationResult = {
  status: 'succeeded' | 'failed' | 'processing' | 'pending';
  output?: unknown;
  error?: string;
};

export abstract class BaseAdapter {
  protected effect: EffectRecord;

  constructor(effect: EffectRecord) {
    this.effect = effect;
  }

  abstract createGeneration(input: unknown): Promise<GenerationResult>;

  async checkStatus?(taskId: string): Promise<GenerationResult>;

  estimateCost?(input: unknown): number;
}
