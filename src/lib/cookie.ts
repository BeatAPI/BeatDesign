export function getCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || '';
  }
  return '';
}

export function setCookie(name: string, value: string, days?: number): void {
  if (typeof document === 'undefined') return;
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = `; expires=${date.toUTCString()}`;
  }
  document.cookie = `${name}=${value}${expires}; path=/`;
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export function getCookieFromHeader(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return undefined;
}

export function getHeaderValue(ctx: any, headerName: string): string | undefined {
  const h = ctx?.headers ?? ctx?.request?.headers;
  if (!h) return undefined;
  if (typeof h.get === 'function') {
    return h.get(headerName) ?? undefined;
  }
  if (typeof h === 'object') {
    return h[headerName] ?? h[headerName.toLowerCase()] ?? undefined;
  }
  return undefined;
}

export function getCookieFromCtx(ctx: any, name: string): string | undefined {
  if (typeof ctx?.getCookie === 'function') {
    const v = ctx.getCookie(name);
    if (typeof v === 'string') return v;
  }
  const cookieHeader = getHeaderValue(ctx, 'cookie');
  return getCookieFromHeader(cookieHeader, name);
}

export function guessLocaleFromAcceptLanguage(acceptLanguage: string | undefined) {
  if (!acceptLanguage) return '';
  const first = acceptLanguage.split(',')[0]?.trim() ?? '';
  const lang = first.split('-')[0]?.trim() ?? '';
  return lang.replace(/[^\w-]/g, '').slice(0, 10);
}
