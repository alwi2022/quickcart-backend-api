//app/api/admin/brands/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Brand } from '@/app/db/models';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

function toSlug(s='') {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-');
}

export async function GET(req) {
  try {
    await dbConnect();
    requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '6');
    const q = searchParams.get('q') || '';
    const filter = {}; // bisa tambahin parent / keyword filter di sini

    const total = await Brand.countDocuments(filter);
    const items = await Brand.find(filter)
        .or([{ name: { $regex: q, $options: 'i' } }, { slug: { $regex: q, $options: 'i' } }])
        .sort({ order: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    return Response.json({
        items,
        page,
        total,
        totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    requireAdmin();

    const body = await request.json();
    if (!body?.name) throw new BadRequestError('name wajib');
    const doc = await Brand.create({
      name: body.name,
      slug: body.slug || toSlug(body.name),
      logo_url: body.logo_url || '',
      country: body.country || '',
      status: body.status || 'active',
    });
    return json({ item: { _id: doc._id } }, { status: 201 });
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.slug) {
      return json({ error: 'Slug sudah dipakai' }, { status: 400 });
    }
    return handleApiError(e);
  }
}
