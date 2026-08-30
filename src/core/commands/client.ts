import { ApiError, apiJsonPost } from '@/lib/api-client';

import {
  createCommandId,
  type BeatDesignCommandResult,
} from './contracts';
import type { BeatDesignCommand, BeatDesignCommandData } from './executor';

const isCommandResult = (
  value: unknown
): value is BeatDesignCommandResult<BeatDesignCommandData> =>
  Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { ok?: unknown }).ok === 'boolean' &&
      typeof (value as { commandId?: unknown }).commandId === 'string'
  );

export async function executeProjectCommand({
  projectId,
  command,
  expectedRevision,
  commandId = createCommandId(),
  idempotencyKey = commandId,
}: {
  projectId: string;
  command: BeatDesignCommand;
  expectedRevision?: number | null;
  commandId?: string;
  idempotencyKey?: string;
}): Promise<BeatDesignCommandResult<BeatDesignCommandData>> {
  try {
    return await apiJsonPost<BeatDesignCommandResult<BeatDesignCommandData>>(
      `/api/app/projects/${encodeURIComponent(projectId)}/commands`,
      {
        commandId,
        expectedRevision,
        idempotencyKey,
        command,
      }
    );
  } catch (error) {
    if (error instanceof ApiError && isCommandResult(error.data)) {
      return error.data;
    }
    throw error;
  }
}
