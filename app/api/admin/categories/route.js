//app/api/admin/categories/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Category } from '@/app/db/models';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

function toSlug(s = '') {
    return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

export async function GET(req) {
    await requireAdmin();
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '6');
    const q = searchParams.get('q') || '';
    const filter = {}; // bisa tambahin parent / keyword filter di sini

    const total = await Category.countDocuments(filter);
    const items = await Category.find(filter)
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
}

export async function POST(request) {
    try {
        await requireAdmin();
        await dbConnect();

        const body = await request.json();
        if (!body?.name) throw new BadRequestError('name wajib');
        // Normalisasi image → string URL
        const image =
            typeof body.image === 'string'
                ? body.image
                : Array.isArray(body.image)
                    ? (typeof body.image[0] === 'string' ? body.image[0] : body.image[0]?.url)
                    : body.image?.url || '';

        if (!image) {
            // Jika mau wajib, hard fail; kalau tidak, bisa beri default kosong
            // Supaya sesuai schema "required: true", kita fail dengan jelas:
            throw new BadRequestError('image wajib (URL)');
        }

        let parent = null; let ancestors = [];
        if (body.parent_id) {
            parent = await Category.findById(body.parent_id).lean();
            if (!parent) throw new BadRequestError('Parent tidak ditemukan');
            ancestors = [...(parent.ancestors || []), { _id: parent._id, name: parent.name, slug: parent.slug }];
        }

        const slug = body.slug || toSlug(body.name);
        const doc = await Category.create({
            name: body.name,
            image,
            slug,
            parent_id: parent ? parent._id : null,
            ancestors,
            order: Number(body.order || 0),
        });

        return json({ item: { _id: doc._id } }, { status: 201 });
    } catch (e) {
        if (e?.code === 11000 && e?.keyPattern?.slug) {
            return json({ error: 'Slug sudah dipakai' }, { status: 400 });
        }
        return handleApiError(e);
    }
}
