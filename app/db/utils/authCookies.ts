const isProd = process.env.NODE_ENV === 'production';
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7;

type RequestLike = Pick<Request, 'headers'>;

export function makeAuthCookie(token: string, maxAge: number = DEFAULT_MAX_AGE): string {
  return [
    `gt_auth=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    isProd ? `Secure` : null,
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join('; ');
}

export function clearAuthCookie(): string {
  return [
    `gt_auth=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    isProd ? `Secure` : null,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ].filter(Boolean).join('; ');
}

export function getTokenFromCookies(request: RequestLike): string | null {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)gt_auth=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
