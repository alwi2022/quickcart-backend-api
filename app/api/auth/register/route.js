//app/api/auth/register/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { User } from '@/app/db/models';
import { hashPassword } from '@/app/db/utils/bcrypt';
import { signToken } from '@/app/db/utils/jwt';
import { registerSchema } from '@/app/db/utils/validators';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { makeAuthCookie } from '@/app/db/utils/authCookies';

export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { name, email, password } = registerSchema.parse(body);

    const exists = await User.findOne({ email }).lean();
    console.log(exists,'ini email',exists)
    if (exists) throw new BadRequestError('Email sudah terdaftar');

    const password_hash = await hashPassword(password);

    const doc = await User.create({
      name,
      email,
      password_hash,
      roles: ['customer'],
      status: 'active',
    });

    const token = signToken({ sub: String(doc._id), roles: doc.roles });

    // Set HttpOnly cookie
    const headers = new Headers();
    headers.append('Set-Cookie', makeAuthCookie(token));

    return json({
      user: { _id: doc._id, name: doc.name, email: doc.email, roles: doc.roles }
    }, { status: 201, headers });
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.email) {
      return json({ error: 'Email sudah terdaftar' }, { status: 400 });
    }
    return handleApiError(e);
  }
}
