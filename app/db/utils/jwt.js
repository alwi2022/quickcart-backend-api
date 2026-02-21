// utils/jwt.js
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const DEFAULT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!SECRET) {
  // Jangan crash saat build; tapi informatif saat runtime
  console.warn('JWT_SECRET is not set. Set it in .env.local');
}

export function signToken(payload, opts = {}) {
  // payload minimal: { sub: userId, roles: [...] }
  return jwt.sign(payload, SECRET, { expiresIn: opts.expiresIn || DEFAULT_EXPIRES_IN });
}

export function verifyToken(token) {
  // throw error jika invalid/expired → akan ditangani errorHandler
  return jwt.verify(token, SECRET);
}

// Helper ambil token dari Authorization: Bearer <token>
export function getBearerTokenFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
