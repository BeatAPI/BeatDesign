import { BaseAdapter } from './base-adapter';

export class MockAdapter extends BaseAdapter {
  async createGeneration(input: unknown) {
    return {
      status: 'succeeded' as const,
      output: {
        mock: true,
        input,
        effectId: this.effect.id,
        provider: this.effect.provider,
      },
    };
  }
}
