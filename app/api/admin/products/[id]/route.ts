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
  brand_id?: unknown;
  category_id?: unknown;
  brand?: unknown;
  category?: unknown;
} & Record<string, unknown>;

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();
    const { id } = await params;

    const product = ((await Product.findById(id).lean()) as unknown) as ProductDetail | null;
    if (!product) throw new NotFoundError('Product not found');

    if (product.brand_id) {
      const brand = await Brand.findById(product.brand_id).select('name slug').lean();
      product.brand = brand || null;
    }
    if (product.category_id) {
      const category = await Category.findById(product.category_id).select('name slug').lean();
      product.category = category || null;
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

