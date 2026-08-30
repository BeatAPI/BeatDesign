export type BeatDesignCommandOrigin = 'ui' | 'mcp' | 'cli' | 'system';

export type BeatDesignCommandEnvelope<TCommand> = {
  commandId: string;
  projectId: string;
  origin: BeatDesignCommandOrigin;
  expectedRevision?: number | null;
  idempotencyKey?: string | null;
  command: TCommand;
};

export type BeatDesignCommandSuccess<TData = undefined> = {
  ok: true;
  commandId: string;
  projectId: string;
  origin: BeatDesignCommandOrigin;
  changedIds: string[];
  warnings: string[];
  revision?: number;
  jobId?: string;
  editorUrl?: string;
  data: TData;
};

export type BeatDesignCommandFailure = {
  ok: false;
  commandId: string;
  projectId: string;
  origin: BeatDesignCommandOrigin;
  changedIds: [];
  warnings: string[];
  code:
    | 'INVALID_COMMAND'
    | 'NOT_FOUND'
    | 'REVISION_CONFLICT'
    | 'COMMAND_FAILED';
  message: string;
  revision?: number;
};

export type BeatDesignCommandResult<TData = undefined> =
  | BeatDesignCommandSuccess<TData>
  | BeatDesignCommandFailure;

export class BeatDesignCommandError extends Error {
  readonly code: BeatDesignCommandFailure['code'];

  constructor(
    code: BeatDesignCommandFailure['code'],
    message: string
  ) {
    super(message);
    this.name = 'BeatDesignCommandError';
    this.code = code;
  }
}

export const createCommandId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createCommandFailure = ({
  commandId,
  projectId,
  origin,
  code,
  message,
  revision,
  warnings = [],
}: {
  commandId: string;
  projectId: string;
  origin: BeatDesignCommandOrigin;
  code: BeatDesignCommandFailure['code'];
  message: string;
  revision?: number;
  warnings?: string[];
}): BeatDesignCommandFailure => ({
  ok: false,
  commandId,
  projectId,
  origin,
  changedIds: [],
  warnings,
  code,
  message,
  ...(typeof revision === 'number' ? { revision } : {}),
});

export const createCommandSuccess = <TData>({
  commandId,
  projectId,
  origin,
  changedIds = [],
  warnings = [],
  revision,
  jobId,
  editorUrl,
  data,
}: {
  commandId: string;
  projectId: string;
  origin: BeatDesignCommandOrigin;
  changedIds?: string[];
  warnings?: string[];
  revision?: number;
  jobId?: string;
  editorUrl?: string;
  data: TData;
}): BeatDesignCommandSuccess<TData> => ({
  ok: true,
  commandId,
  projectId,
  origin,
  changedIds: Array.from(new Set(changedIds)),
  warnings,
  ...(typeof revision === 'number' ? { revision } : {}),
  ...(jobId ? { jobId } : {}),
  ...(editorUrl ? { editorUrl } : {}),
  data,
});
