//app/api/auth/login/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { User } from '@/app/db/models';
import { verifyPassword } from '@/app/db/utils/bcrypt';
import { signToken } from '@/app/db/utils/jwt';
import { loginSchema } from '@/app/db/utils/validators';
import { handleApiError, json, UnauthorizedError } from '@/app/db/utils/errors';
import { makeAuthCookie } from '@/app/db/utils/authCookies';

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await User.findOne({ email }).lean();
    if (!user || !user.password_hash) throw new UnauthorizedError('Email atau password salah');

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new UnauthorizedError('Email atau password salah');

    const token = signToken({ sub: String(user._id), roles: user.roles || ['customer'] });

    const headers = new Headers();
    headers.append('Set-Cookie', makeAuthCookie(token));

  
    return json({
      user: { _id: user._id, name: user.name, email: user.email, roles: user.roles }
    }, { headers });
  } catch (e) {
    return handleApiError(e);
  }
}
