const resolveServerPath = (...segments: string[]) => {
  if (typeof process.getBuiltinModule !== 'function') {
    throw new Error('BeatDesign data paths are only available in the local Node runtime.');
  }
  const path = process.getBuiltinModule('node:path') as typeof import('node:path');
  return path.resolve(...segments);
};

export const getBeatDesignDataRoot = (
  workspaceRoot = process.cwd(),
  configuredRoot = process.env.BEATDESIGN_DATA_DIR?.trim()
) => {
  return configuredRoot
    ? resolveServerPath(configuredRoot)
    : resolveServerPath(workspaceRoot, 'data');
};

export const getBeatDesignDatabaseUrl = (
  workspaceRoot = process.cwd(),
  configuredRoot = process.env.BEATDESIGN_DATA_DIR?.trim()
) => {
  return configuredRoot
    ? `file:${resolveServerPath(configuredRoot, 'local.db')}`
    : 'file:data/local.db';
};
