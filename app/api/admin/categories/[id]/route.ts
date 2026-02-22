export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Category from '@/app/db/models/Category';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CategoryAncestor = {
  _id: unknown;
  name?: string;
  slug?: string;
};

type CategoryLike = {
  _id: unknown;
  name?: string;
  slug?: string;
  image?: string;
  order?: number;
  parent_id?: unknown | null;
  ancestors?: CategoryAncestor[];
};

type CategoryDoc = CategoryLike & {
  save: () => Promise<unknown>;
};

type CategoryImageInput = string | { url?: string } | Array<string | { url?: string }>;

type CategoryPatchBody = {
  name?: string;
  slug?: string;
  order?: number | string;
  image?: CategoryImageInput;
  parent_id?: string | null;
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

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();
    const { id } = await params;

    const item = await Category.findById(id).lean();
    if (!item) throw new BadRequestError('Kategori tidak ditemukan');
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
    const body = (await request.json()) as CategoryPatchBody;

    const doc = ((await Category.findById(id)) as unknown) as CategoryDoc | null;
    if (!doc) throw new BadRequestError('Kategori tidak ditemukan');

    if (body.name !== undefined) doc.name = body.name;
    if (body.slug !== undefined) doc.slug = body.slug || toSlug(doc.name || '');
    if (body.order !== undefined) doc.order = Number(body.order) || 0;
    if (body.image !== undefined) doc.image = toImageUrl(body.image);

    if (body.parent_id !== undefined) {
      let parent: CategoryLike | null = null;
      let ancestors: CategoryAncestor[] = [];

      if (body.parent_id) {
        parent = ((await Category.findById(body.parent_id).lean()) as unknown) as CategoryLike | null;
        if (!parent) throw new BadRequestError('Parent tidak ditemukan');
        ancestors = [...(parent.ancestors || []), { _id: parent._id, name: parent.name, slug: parent.slug }];
      }

      doc.parent_id = parent ? parent._id : null;
      doc.ancestors = ancestors;
    }

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

    const hasChild = await Category.exists({ parent_id: id });
    if (hasChild) {
      return json({ error: 'Masih ada subkategori. Hapus/relokasi dulu.' }, { status: 400 });
    }

    await Category.findByIdAndDelete(id);
    return json({ ok: true });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

