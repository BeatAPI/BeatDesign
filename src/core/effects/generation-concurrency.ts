export const MAX_RUNNING_GENERATIONS_PER_PROJECT = 7;

export type GenerationConcurrencyGateResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: 'ANOTHER_PROJECT_RUNNING';
      activeProjectId: string;
    }
  | {
      ok: false;
      code: 'PROJECT_CONCURRENCY_LIMIT';
      limit: number;
    };

export const resolveGenerationConcurrencyGate = ({
  requestedProjectId,
  activeProjectId,
  runningCountForRequestedProject,
  limit = MAX_RUNNING_GENERATIONS_PER_PROJECT,
}: {
  requestedProjectId: string;
  activeProjectId: string | null;
  runningCountForRequestedProject: number;
  limit?: number;
}): GenerationConcurrencyGateResult => {
  if (activeProjectId && activeProjectId !== requestedProjectId) {
    return {
      ok: false,
      code: 'ANOTHER_PROJECT_RUNNING',
      activeProjectId,
    };
  }

  if (runningCountForRequestedProject >= limit) {
    return {
      ok: false,
      code: 'PROJECT_CONCURRENCY_LIMIT',
      limit,
    };
  }

  return {
    ok: true,
  };
};

export const getGenerationConcurrencyErrorMessage = (
  result: Exclude<GenerationConcurrencyGateResult, { ok: true }>
) => {
  switch (result.code) {
    case 'ANOTHER_PROJECT_RUNNING':
      return 'Another project is already running for this account.';
    case 'PROJECT_CONCURRENCY_LIMIT':
      return `This project already has ${result.limit} running generations.`;
  }
};
