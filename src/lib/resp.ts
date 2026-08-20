export function respData(data: any) {
  return respJson(0, 'ok', data);
}

export function respOk() {
  return respJson(0, 'ok');
}

export function respErr(message: string, status = 400, code = -1) {
  return respJson(code, message, undefined, { status });
}

export function respUnauthorized(message = 'Unauthorized') {
  return respErr(message, 401);
}

export function respForbidden(message = 'Forbidden') {
  return respErr(message, 403);
}

export function respInternalError(message = 'Internal server error') {
  return respErr(message, 500);
}

export function respPage(items: any[], total: number) {
  return respJson(0, 'ok', { items, total });
}

export function respJson(
  code: number,
  message: string,
  data?: any,
  init?: ResponseInit
) {
  let json: Record<string, any> = {
    code: code,
    message: message,
  };
  if (data !== undefined) {
    json['data'] = data;
  }
  return Response.json(json, init);
}
