import jwt from 'jsonwebtoken';
import type { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const DEFAULT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

export type AuthTokenPayload = JwtPayload & {
  sub: string;
  roles?: string[];
};

if (!SECRET) {
  console.warn('JWT_SECRET is not set. Set it in .env.local');
}

function getJwtSecret(): Secret {
  if (!SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  return SECRET;
}

export function signToken(
  payload: Record<string, unknown>,
  opts: { expiresIn?: SignOptions['expiresIn'] } = {},
): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: opts.expiresIn ?? DEFAULT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
}

export function getBearerTokenFromRequest(request: Pick<Request, 'headers'>): string | null {
  const auth = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!auth) return null;

  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  return token;
}
