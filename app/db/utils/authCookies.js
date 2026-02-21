// Node runtime only (App Router route handlers)
const isProd = process.env.NODE_ENV === 'production';
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export function makeAuthCookie(token, maxAge = DEFAULT_MAX_AGE) {
  // SameSite=Lax aman untuk form POST
  return [
    `gt_auth=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    isProd ? `Secure` : null,
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join('; ');
}

export function clearAuthCookie() {
  return [
    `gt_auth=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    isProd ? `Secure` : null,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ].filter(Boolean).join('; ');
}

// Ekstrak token dari Cookie
export function getTokenFromCookies(request) {
  const cookie = request.headers.get('cookie') || '';
  console.log(cookie,'ini cookie')
  const m = cookie.match(/(?:^|;\s*)gt_auth=([^;]+)/);
  console.log(m,'ini m')
  return m ? decodeURIComponent(m[1]) : null;
}
