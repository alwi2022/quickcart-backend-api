export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Brand from '@/app/db/models/Brand';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BrandPatchBody = {
  name?: string;
  slug?: string;
  logo_url?: string;
  country?: string;
  status?: string;
};

type BrandDoc = {
  _id: unknown;
  name?: string;
  slug?: string;
  logo_url?: string;
  country?: string;
  status?: string;
  save: () => Promise<unknown>;
};

type DuplicateKeyError = {
  code: number;
  keyPattern?: Record<string, unknown>;
};

function toSlug(value = ''): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function isDuplicateSlugError(error: unknown): error is DuplicateKeyError {
  if (typeof error !== 'object' || error === null) return false;
  const maybe = error as DuplicateKeyError;
  return maybe.code === 11000 && Boolean(maybe.keyPattern?.slug);
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();

    const { id } = await params;
    const item = await Brand.findById(id).lean();
    if (!item) throw new BadRequestError('Brand tidak ditemukan');
    return json({ item });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();

    const { id } = await params;
    const body = (await request.json()) as BrandPatchBody;
    const doc = ((await Brand.findById(id)) as unknown) as BrandDoc | null;
    if (!doc) throw new BadRequestError('Brand tidak ditemukan');

    if (body.name !== undefined) doc.name = body.name;
    if (body.slug !== undefined) doc.slug = body.slug || toSlug(doc.name || '');
    if (body.logo_url !== undefined) doc.logo_url = body.logo_url;
    if (body.country !== undefined) doc.country = body.country;
    if (body.status !== undefined) doc.status = body.status;

    await doc.save();
    return json({ item: { _id: doc._id } });
  } catch (e: unknown) {
    if (isDuplicateSlugError(e)) {
      return json({ error: 'Slug sudah dipakai' }, { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();
    const { id } = await params;
    await Brand.findByIdAndDelete(id);
    return json({ ok: true });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

