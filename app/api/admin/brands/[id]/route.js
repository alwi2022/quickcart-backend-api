//app/api/admin/brands/[id]/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Brand } from '@/app/db/models';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

function toSlug(s='') {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-');
}

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    requireAdmin();
    const item = await Brand.findById(params.id).lean();
    if (!item) throw new BadRequestError('Brand tidak ditemukan');
    return json({ item });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    requireAdmin();
    const body = await request.json();

    const doc = await Brand.findById(params.id);
    if (!doc) throw new BadRequestError('Brand tidak ditemukan');

    if (body.name !== undefined) doc.name = body.name;
    if (body.slug !== undefined) doc.slug = body.slug || toSlug(doc.name);
    if (body.logo_url !== undefined) doc.logo_url = body.logo_url;
    if (body.country !== undefined) doc.country = body.country;
    if (body.status !== undefined) doc.status = body.status;

    await doc.save();
    return json({ item: { _id: doc._id } });
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.slug) {
      return json({ error: 'Slug sudah dipakai' }, { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(_req, { params }) {
  try {
    await dbConnect();
    requireAdmin();
    await Brand.findByIdAndDelete(params.id);
    return json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
