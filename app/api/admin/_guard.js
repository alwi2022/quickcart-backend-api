// app/api/_guard.js
import { cookies } from 'next/headers';
import { verifyToken } from '@/app/db/utils/jwt';
import { UnauthorizedError, ForbiddenError } from '@/app/db/utils/errors';

export async function getUserFromCookie() {
  // ✅ await cookies(), lalu baru .get()
  const cookieStore = await cookies();
  const token = cookieStore.get('gt_auth')?.value;
  if (!token) throw new UnauthorizedError('Unauthorized');

  const payload = verifyToken(token); // kalau verify async, jadikan: await verifyToken(token)
  return payload; // { sub, roles, iat, exp }
}

export async function requireUser() {
  const u = await getUserFromCookie(); // ✅ await
  if (!u?.sub) throw new UnauthorizedError('Unauthorized');
  return u;
}

export async function requireAdmin() {
  const u = await requireUser(); // ✅ await
  const roles = Array.isArray(u?.roles) ? u.roles : [];
  if (!roles.includes('admin')) throw new ForbiddenError('Forbidden');
  return u;
}
