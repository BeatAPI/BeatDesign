export class ResponseBodyTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Response body exceeds ${maxBytes} bytes`);
    this.name = 'ResponseBodyTooLargeError';
  }
}

export async function readResponseBodyWithLimit(
  response: Response,
  maxBytes: number
): Promise<Uint8Array> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    if (Number(declaredLength) > maxBytes) {
      await response.body?.cancel();
      throw new ResponseBodyTooLargeError(maxBytes);
    }
  }

  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ResponseBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readResponseJsonWithLimit(
  response: Response,
  maxBytes: number
): Promise<unknown> {
  const body = await readResponseBodyWithLimit(response, maxBytes);
  if (body.byteLength === 0) return null;
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    return null;
  }
}
