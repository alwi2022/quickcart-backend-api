import { cookies } from 'next/headers';
import { verifyToken } from '@/app/db/utils/jwt';
import type { AuthTokenPayload } from '@/app/db/utils/jwt';
import { UnauthorizedError, ForbiddenError } from '@/app/db/utils/errors';

export async function getUserFromCookie(): Promise<AuthTokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get('gt_auth')?.value;

  if (!token) {
    throw new UnauthorizedError('Unauthorized');
  }

  return verifyToken(token);
}

export async function requireUser(): Promise<AuthTokenPayload> {
  const user = await getUserFromCookie();
  if (!user?.sub) {
    throw new UnauthorizedError('Unauthorized');
  }
  return user;
}

export async function requireAdmin(): Promise<AuthTokenPayload> {
  const user = await requireUser();
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (!roles.includes('admin')) {
    throw new ForbiddenError('Forbidden');
  }
  return user;
}
