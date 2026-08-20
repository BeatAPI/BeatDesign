declare global {
  var __beatapiGenerationSubmissionTail: Promise<void> | undefined;
}

export async function withGenerationSubmissionLock<T>(
  work: () => Promise<T>
): Promise<T> {
  const previous = globalThis.__beatapiGenerationSubmissionTail ?? Promise.resolve();
  let release: () => void = () => {};
  globalThis.__beatapiGenerationSubmissionTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}
