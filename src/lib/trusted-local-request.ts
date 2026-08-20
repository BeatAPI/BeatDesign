const LOCAL_SETTINGS_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export const WORKSPACE_MUTATION_HEADER = 'x-beatapi-workspace-request';
export const WORKSPACE_MUTATION_HEADER_VALUE = '1';

export type TrustedLocalRequestResult =
  | { ok: true }
  | { ok: false; status: 403 | 415; message: string };

export function validateTrustedWorkspaceJsonMutation(
  request: Request
): TrustedLocalRequestResult {
  if (
    request.headers.get(WORKSPACE_MUTATION_HEADER) !==
    WORKSPACE_MUTATION_HEADER_VALUE
  ) {
    return {
      ok: false,
      status: 403,
      message: 'Untrusted workspace request.',
    };
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return {
      ok: false,
      status: 415,
      message: 'Workspace requests must use application/json.',
    };
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return { ok: false, status: 403, message: 'Cross-site request rejected.' };
  }

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const requestUrl = new URL(request.url);
      if (new URL(origin).origin !== requestUrl.origin) {
        return { ok: false, status: 403, message: 'Cross-site request rejected.' };
      }
    } catch {
      return { ok: false, status: 403, message: 'Invalid request origin.' };
    }
  }

  return { ok: true };
}

export function validateTrustedLocalJsonMutation(
  request: Request
): TrustedLocalRequestResult {
  const requestUrl = new URL(request.url);
  if (!LOCAL_SETTINGS_HOSTS.has(requestUrl.hostname)) {
    return {
      ok: false,
      status: 403,
      message:
        'Settings can only be changed locally; use deployment secrets on hosted instances.',
    };
  }

  return validateTrustedWorkspaceJsonMutation(request);
}
