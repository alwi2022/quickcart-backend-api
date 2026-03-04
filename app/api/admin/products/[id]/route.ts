export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Product from '@/app/db/models/Product';
import Brand from '@/app/db/models/Brand';
import Category from '@/app/db/models/Category';
import { handleApiError, json, NotFoundError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProductDetail = {
  brandId?: unknown;
  categoryIds?: unknown[];
  brand?: unknown;
  categories?: unknown[];
  category?: unknown;
} & Record<string, unknown>;

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();
    const { id } = await params;

    const product = ((await Product.findById(id).lean()) as unknown) as ProductDetail | null;
    if (!product) throw new NotFoundError('Product not found');

    if (product.brandId) {
      const brand = await Brand.findById(product.brandId).select('name slug').lean();
      product.brand = brand || null;
    }

    if (Array.isArray(product.categoryIds) && product.categoryIds.length > 0) {
      const categories = await Category.find({ _id: { $in: product.categoryIds } })
        .select('name slug')
        .lean();
      product.categories = categories || [];
      product.category = categories?.[0] || null;
    }

    return json({ item: product });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();
    const { id } = await params;

    const body = (await req.json()) as Record<string, unknown>;
    const doc = await Product.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true }).lean();
    if (!doc) throw new NotFoundError('Product not found');
    return json({ item: doc });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();
    const { id } = await params;

    const doc = await Product.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundError('Product not found');
    return json({ ok: true });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

