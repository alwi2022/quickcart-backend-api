export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import User from '@/app/db/models/User';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';
import { hashPassword } from '@/app/db/utils/bcrypt';

type UserFilter = {
  $or?: Array<{ email?: RegExp; name?: RegExp; phone?: RegExp }>;
  status?: string;
  roles?: string;
};

type UserCreateBody = {
  email?: string;
  name?: string;
  phone?: string | null;
  password?: string;
  roles?: string[];
  status?: string;
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

export async function GET(request: Request) {
  try {
    await requireAdmin();
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const role = (searchParams.get('role') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const skip = (page - 1) * limit;

    const filter: UserFilter = {};
    if (q) {
      filter.$or = [{ email: new RegExp(q, 'i') }, { name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }];
    }
    if (status) filter.status = status;
    if (role) filter.roles = role;

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name email phone roles status createdAt')
        .lean(),
      User.countDocuments(filter),
    ]);

    return json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await dbConnect();

    const body = (await request.json()) as UserCreateBody;
    if (!body.email || !body.name) throw new BadRequestError('name & email wajib');
    if (!body.password) throw new BadRequestError('password wajib');

    const exists = await User.findOne({ email: body.email }).lean();
    if (exists) throw new BadRequestError('Email sudah terdaftar');
    const password_hash = await hashPassword(body.password);

    const doc = ((await User.create({
      email: body.email,
      name: body.name,
      phone: body.phone || null,
      roles: Array.isArray(body.roles) && body.roles.length ? body.roles : ['customer'],
      status: body.status || 'active',
      password_hash,
    })) as unknown) as { _id: unknown };

    return json({ item: { _id: doc._id } }, { status: 201 });
  } catch (e: unknown) {
    if (isDuplicateEmailError(e)) {
      return json({ error: 'Email sudah terdaftar' }, { status: 400 });
    }
    return handleApiError(e);
  }
}

