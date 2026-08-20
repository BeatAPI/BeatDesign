export class RequestBodyTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = 'RequestBodyTooLargeError';
  }
}

export async function readRequestBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<Uint8Array> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    if (Number(declaredLength) > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError(maxBytes);
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

export async function readRequestTextWithLimit(
  request: Request,
  maxBytes: number
): Promise<string> {
  return new TextDecoder().decode(
    await readRequestBodyWithLimit(request, maxBytes)
  );
}

export async function readRequestFormDataWithLimit(
  request: Request,
  maxBytes: number
): Promise<FormData> {
  const body = await readRequestBodyWithLimit(request, maxBytes);
  const bodyBuffer = new ArrayBuffer(body.byteLength);
  new Uint8Array(bodyBuffer).set(body);
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bodyBuffer,
  }).formData();
}
