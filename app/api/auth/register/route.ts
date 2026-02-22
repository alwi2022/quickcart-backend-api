export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import User from '@/app/db/models/User';
import { hashPassword } from '@/app/db/utils/bcrypt';
import { signToken } from '@/app/db/utils/jwt';
import { registerSchema } from '@/app/db/utils/validators';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { makeAuthCookie } from '@/app/db/utils/authCookies';

type RegisterUser = {
  _id: unknown;
  name?: string;
  email?: string;
  roles?: string[];
};

type DuplicateKeyError = {
  code: number;
  keyPattern?: Record<string, unknown>;
};

function isDuplicateEmailError(error: unknown): error is DuplicateKeyError {
  if (typeof error !== 'object' || error === null) return false;
  const maybe = error as DuplicateKeyError;
  return maybe.code === 11000 && Boolean(maybe.keyPattern?.email);
}

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { name, email, password } = registerSchema.parse(body);

    const exists = await User.findOne({ email }).lean();
    if (exists) throw new BadRequestError('Email sudah terdaftar');

    const password_hash = await hashPassword(password);

    const doc = ((await User.create({
      name,
      email,
      password_hash,
      roles: ['customer'],
      status: 'active',
    })) as unknown) as RegisterUser;

    const token = signToken({ sub: String(doc._id), roles: doc.roles });

    const headers = new Headers();
    headers.append('Set-Cookie', makeAuthCookie(token));

    return json(
      {
        user: { _id: doc._id, name: doc.name, email: doc.email, roles: doc.roles },
      },
      { status: 201, headers },
    );
  } catch (e: unknown) {
    if (isDuplicateEmailError(e)) {
      return json({ error: 'Email sudah terdaftar' }, { status: 400 });
    }
    return handleApiError(e);
  }
}
