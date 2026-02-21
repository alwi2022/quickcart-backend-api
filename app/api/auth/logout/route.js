export const runtime = 'nodejs';

import { json } from '@/app/db/utils/errors';
import { clearAuthCookie } from '@/app/db/utils/authCookies';

export async function POST() {
  const headers = new Headers();
  headers.append('Set-Cookie', clearAuthCookie());
  return json({ ok: true }, { headers });
}
