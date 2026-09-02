import { createServer, type IncomingMessage, type Server } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

import {
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  type McpHttpHandler,
} from '@modelcontextprotocol/server';

import { createBeatDesignMcpHttpHandler } from './server';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3031;
const MCP_PATH = '/mcp';
const MAX_BODY_BYTES = 2 * 1024 * 1024;

type HttpServerOptions = {
  host?: string;
  port?: number;
  token?: string;
};

const readBody = (request: IncomingMessage) =>
  new Promise<Buffer>((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    request.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('MCP HTTP request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks)));
    request.on('error', reject);
  });

const toWebRequest = async (request: IncomingMessage) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers.set(name, value.join(', '));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const method = request.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(request);
  const host = headers.get('host') ?? `${DEFAULT_HOST}:${DEFAULT_PORT}`;
  return new Request(`http://${host}${request.url ?? '/'}`, {
    method,
    headers,
    body: body && body.length > 0 ? body.toString('utf8') : undefined,
  });
};

const writeWebResponse = async (
  response: Response,
  reply: import('node:http').ServerResponse
) => {
  reply.statusCode = response.status;
  response.headers.forEach((value, name) => reply.setHeader(name, value));
  if (!response.body) {
    reply.end();
    return;
  }
  const stream = Readable.fromWeb(response.body as NodeReadableStream);
  await new Promise<void>((resolveStream, rejectStream) => {
    stream.once('error', rejectStream);
    reply.once('error', rejectStream);
    reply.once('finish', resolveStream);
    stream.pipe(reply);
  });
};

const errorResponse = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const bearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  return request.headers.get('x-beatdesign-mcp-token');
};

const resolvePort = (value: string | undefined) => {
  if (!value) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('BEATDESIGN_MCP_HTTP_PORT must be an integer from 0 to 65535.');
  }
  return port;
};

const isLoopbackHost = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';

const hostnameForAllowlist = (host: string) => {
  const authority = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return new URL(`http://${authority}`).hostname;
};

const closeHandler = async (handler: McpHttpHandler) => {
  try {
    await handler.close();
  } catch (error) {
    console.error('[BeatDesign MCP HTTP] Close failed:', error);
  }
};

export async function startBeatDesignMcpHttpServer(
  options: HttpServerOptions = {}
): Promise<Server> {
  const host = options.host ?? process.env.BEATDESIGN_MCP_HTTP_HOST ?? DEFAULT_HOST;
  const port = options.port ?? resolvePort(process.env.BEATDESIGN_MCP_HTTP_PORT);
  const token = options.token ?? process.env.BEATDESIGN_MCP_TOKEN?.trim();
  if (!isLoopbackHost(host) && !token) {
    throw new Error(
      'BEATDESIGN_MCP_TOKEN is required when BEATDESIGN_MCP_HTTP_HOST is not loopback.'
    );
  }
  const handler = createBeatDesignMcpHttpHandler();

  const nodeServer = createServer(async (request, reply) => {
    try {
      const webRequest = await toWebRequest(request);
      const url = new URL(webRequest.url);
      if (url.pathname !== MCP_PATH) {
        await writeWebResponse(errorResponse(404, 'MCP endpoint not found.'), reply);
        return;
      }

      const allowedHostnames = isLoopbackHost(host)
        ? localhostAllowedHostnames()
        : [...localhostAllowedHostnames(), hostnameForAllowlist(host)];
      const hostError = hostHeaderValidationResponse(webRequest, allowedHostnames);
      if (hostError) {
        await writeWebResponse(hostError, reply);
        return;
      }

      if (token && bearerToken(webRequest) !== token) {
        await writeWebResponse(
          new Response(JSON.stringify({ error: 'Unauthorized.' }), {
            status: 401,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'www-authenticate': 'Bearer',
            },
          }),
          reply
        );
        return;
      }

      const response = await handler.fetch(webRequest);
      await writeWebResponse(response, reply);
    } catch (error) {
      console.error('[BeatDesign MCP HTTP]', error);
      if (!reply.headersSent) {
        await writeWebResponse(errorResponse(400, 'Invalid MCP HTTP request.'), reply);
      } else {
        reply.destroy();
      }
    }
  });

  nodeServer.once('close', () => void closeHandler(handler));
  await new Promise<void>((resolveListen, rejectListen) => {
    nodeServer.once('error', rejectListen);
    nodeServer.listen(port, host, () => {
      nodeServer.removeListener('error', rejectListen);
      resolveListen();
    });
  });

  const address = nodeServer.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  console.error(`BeatDesign MCP HTTP server listening at http://${host}:${actualPort}${MCP_PATH}`);
  if (!token) {
    console.error('Set BEATDESIGN_MCP_TOKEN to require Bearer authentication.');
  }
  return nodeServer;
}
