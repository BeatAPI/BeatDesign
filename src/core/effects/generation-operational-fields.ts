const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

export const deriveGenerationOperationalFields = ({
  output,
}: {
  output?: unknown;
}) => {
  const outputObject = asObject(output);
  const providerTaskId =
    readString(outputObject.providerTaskId) ?? readString(outputObject.taskId);
  const lifecyclePhase = readString(outputObject.lifecyclePhase);
  const lastProviderSyncAt = providerTaskId ? new Date() : undefined;

  return {
    providerTaskId,
    lifecyclePhase,
    lastProviderSyncAt,
  };
};
