export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Category from '@/app/db/models/Category';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

type CategoryAncestor = {
  _id: unknown;
  name?: string;
  slug?: string;
};

type CategoryLike = {
  _id: unknown;
  name?: string;
  slug?: string;
  ancestors?: CategoryAncestor[];
};

type CategoryFilter = {
  $or?: Array<{ name?: { $regex: string; $options: 'i' }; slug?: { $regex: string; $options: 'i' } }>;
};

type CategoryImageInput = string | { url?: string } | Array<string | { url?: string }>;

type CategoryCreateBody = {
  name?: string;
  image?: CategoryImageInput;
  slug?: string;
  parent_id?: string;
  order?: number | string;
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

function toImageUrl(input: CategoryImageInput | undefined): string {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    const first = input[0];
    if (!first) return '';
    return typeof first === 'string' ? first : first.url || '';
  }
  return input?.url || '';
}

function isDuplicateSlugError(error: unknown): error is DuplicateKeyError {
  if (typeof error !== 'object' || error === null) return false;
  const maybe = error as DuplicateKeyError;
  return maybe.code === 11000 && Boolean(maybe.keyPattern?.slug);
}

export async function GET(req: Request) {
  await requireAdmin();
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '6', 10);
  const q = searchParams.get('q') || '';

  const filter: CategoryFilter = {};
  const total = await Category.countDocuments(filter);
  const items = ((await Category.find(filter)
    .or([{ name: { $regex: q, $options: 'i' } }, { slug: { $regex: q, $options: 'i' } }])
    .sort({ order: 1, name: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()) as unknown) as CategoryLike[];

  return Response.json({
    items,
    page,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    await dbConnect();

    const body = (await request.json()) as CategoryCreateBody;
    if (!body.name) throw new BadRequestError('name wajib');

    const image = toImageUrl(body.image);
    if (!image) throw new BadRequestError('image wajib (URL)');

    let parent: CategoryLike | null = null;
    let ancestors: CategoryAncestor[] = [];
    if (body.parent_id) {
      parent = ((await Category.findById(body.parent_id).lean()) as unknown) as CategoryLike | null;
      if (!parent) throw new BadRequestError('Parent tidak ditemukan');
      ancestors = [...(parent.ancestors || []), { _id: parent._id, name: parent.name, slug: parent.slug }];
    }

    const slug = body.slug || toSlug(body.name);
    const doc = ((await Category.create({
      name: body.name,
      image,
      slug,
      parent_id: parent ? parent._id : null,
      ancestors,
      order: Number(body.order || 0),
    })) as unknown) as { _id: unknown };

    return json({ item: { _id: doc._id } }, { status: 201 });
  } catch (e: unknown) {
    if (isDuplicateSlugError(e)) {
      return json({ error: 'Slug sudah dipakai' }, { status: 400 });
    }
    return handleApiError(e);
  }
}

