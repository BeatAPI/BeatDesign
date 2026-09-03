import type {
  BeatDesignCommandResult,
  BeatDesignCommandSuccess,
} from './contracts';
import { persistBeatDesignCommand } from './persist';

type PersistCommandInput = Parameters<typeof persistBeatDesignCommand>[0];
type PersistCommand = typeof persistBeatDesignCommand;

export type ConflictRecovery = {
  recovered: boolean;
  attempts: number;
  initialExpectedRevision: number | null;
  latestRevision: number | null;
};

export type RetryGuidance = {
  retryable: true;
  expectedRevision: number | null;
  instruction: string;
};

export type ExternalCommandResult<TData> = BeatDesignCommandResult<TData> & {
  conflictRecovery?: ConflictRecovery;
  retry?: RetryGuidance;
};

const asRevision = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Replays an external incremental command against the latest revision.
 *
 * The persistence layer loads the authoritative document before applying an
 * operation, then uses expectedRevision only for the final CAS write. A retry
 * therefore re-runs the same stable-ID operation on the newest document rather
 * than saving a stale full-document replacement.
 */
export async function persistExternalCommandWithConflictRetry<TData>({
  input,
  maxAttempts = 3,
  persist = persistBeatDesignCommand as PersistCommand,
}: {
  input: PersistCommandInput;
  maxAttempts?: number;
  persist?: PersistCommand;
}): Promise<ExternalCommandResult<TData>> {
  const boundedAttempts = Math.max(1, Math.min(3, Math.floor(maxAttempts)));
  const initialExpectedRevision = asRevision(input.expectedRevision);
  let expectedRevision = input.expectedRevision;
  let attempts = 0;

  while (attempts < boundedAttempts) {
    attempts += 1;
    const result = (await persist({
      ...input,
      expectedRevision,
    })) as BeatDesignCommandResult<TData>;

    if (result.ok) {
      if (attempts === 1) return result;
      const latestRevision = asRevision(result.revision);
      const success = result as BeatDesignCommandSuccess<TData>;
      return {
        ...success,
        warnings: [
          ...success.warnings,
          `Recovered from a revision conflict after ${attempts} attempts.`,
        ],
        conflictRecovery: {
          recovered: true,
          attempts,
          initialExpectedRevision,
          latestRevision,
        },
      };
    }

    if (result.code !== 'REVISION_CONFLICT') return result;

    const latestRevision = asRevision(result.revision);
    if (latestRevision === null || attempts >= boundedAttempts) {
      return {
        ...result,
        conflictRecovery: {
          recovered: false,
          attempts,
          initialExpectedRevision,
          latestRevision,
        },
        retry: {
          retryable: true,
          expectedRevision: latestRevision,
          instruction:
            latestRevision === null
              ? 'Read the latest project state, then submit the same incremental operation again.'
              : `Read the latest project state, then retry with expectedRevision ${latestRevision}.`,
        },
      };
    }

    expectedRevision = latestRevision;
  }

  throw new Error('Revision conflict retry loop ended unexpectedly.');
}
