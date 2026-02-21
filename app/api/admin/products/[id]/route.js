export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Product, Brand, Category } from '@/app/db/models';
import { handleApiError, json, NotFoundError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    requireAdmin();
    const p = await Product.findById(params.id).lean();
    if (!p) throw new NotFoundError('Product not found');
    // optional populate shorthand
    if (p.brand_id) {
      const b = await Brand.findById(p.brand_id).select('name slug').lean();
      p.brand = b || null;
    }
    if (p.category_id) {
      const c = await Category.findById(p.category_id).select('name slug').lean();
      p.category = c || null;
    }
    return json({ item: p });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    requireAdmin();
    const body = await req.json();
    const doc = await Product.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) throw new NotFoundError('Product not found');
    return json({ item: doc });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req, { params }) {
  try {
    await dbConnect();
    requireAdmin();
    const doc = await Product.findByIdAndDelete(params.id).lean();
    if (!doc) throw new NotFoundError('Product not found');
    return json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
