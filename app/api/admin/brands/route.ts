export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Brand from '@/app/db/models/Brand';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

type BrandLike = {
  _id: unknown;
  name?: string;
  slug?: string;
};

type BrandFilter = {
  $or?: Array<{ name?: { $regex: string; $options: 'i' }; slug?: { $regex: string; $options: 'i' } }>;
};

type BrandCreateBody = {
  name?: string;
  slug?: string;
  logo_url?: string;
  country?: string;
  status?: string;
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

export async function GET(req: Request) {
  try {
    await dbConnect();
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '6', 10);
    const q = searchParams.get('q') || '';

    const filter: BrandFilter = {};
    const total = await Brand.countDocuments(filter);
    const items = ((await Brand.find(filter)
      .or([{ name: { $regex: q, $options: 'i' } }, { slug: { $regex: q, $options: 'i' } }])
      .sort({ order: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()) as unknown) as BrandLike[];

    return Response.json({
      items,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    await requireAdmin();

    const body = (await request.json()) as BrandCreateBody;
    if (!body.name) throw new BadRequestError('name wajib');

    const doc = ((await Brand.create({
      name: body.name,
      slug: body.slug || toSlug(body.name),
      logo_url: body.logo_url || '',
      country: body.country || '',
      status: body.status || 'active',
    })) as unknown) as { _id: unknown };

    return json({ item: { _id: doc._id } }, { status: 201 });
  } catch (e: unknown) {
    if (isDuplicateSlugError(e)) {
      return json({ error: 'Slug sudah dipakai' }, { status: 400 });
    }
    return handleApiError(e);
  }
}

