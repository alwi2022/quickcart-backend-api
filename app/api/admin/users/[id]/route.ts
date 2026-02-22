export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import User from '@/app/db/models/User';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';
import { hashPassword } from '@/app/db/utils/bcrypt';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UserPatchBody = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  roles?: string[];
  status?: string;
};

type UserDoc = {
  _id: unknown;
  name?: string;
  email?: string;
  phone?: string;
  password_hash?: string;
  roles?: string[];
  status?: string;
  save: () => Promise<unknown>;
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

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    await dbConnect();
    const { id } = await params;
    const item = await User.findById(id).select('-password_hash').lean();
    if (!item) throw new BadRequestError('User tidak ditemukan');
    return json({ item });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    await dbConnect();
    const { id } = await params;
    const body = (await request.json()) as UserPatchBody;

    const doc = ((await User.findById(id)) as unknown) as UserDoc | null;
    if (!doc) throw new BadRequestError('User tidak ditemukan');

    if (body.name !== undefined) doc.name = body.name;
    if (body.email !== undefined) doc.email = body.email;
    if (body.phone !== undefined) doc.phone = body.phone;
    if (body.password !== undefined) doc.password_hash = await hashPassword(body.password);
    if (Array.isArray(body.roles)) doc.roles = body.roles;
    if (body.status) doc.status = body.status;

    await doc.save();
    return json({ item: { _id: doc._id } });
  } catch (e: unknown) {
    if (isDuplicateEmailError(e)) {
      return json({ error: 'Email sudah terpakai' }, { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    await dbConnect();
    const { id } = await params;
    await User.findByIdAndDelete(id);
    return json({ ok: true });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

