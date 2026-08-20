export const workspaceModes = ['studio', 'canvas'] as const;

export type WorkspaceMode = (typeof workspaceModes)[number];

export const defaultWorkspaceMode: WorkspaceMode = 'canvas';

export function resolveWorkspaceMode(value?: string | null): WorkspaceMode {
  return workspaceModes.includes(value as WorkspaceMode)
    ? (value as WorkspaceMode)
    : defaultWorkspaceMode;
}
