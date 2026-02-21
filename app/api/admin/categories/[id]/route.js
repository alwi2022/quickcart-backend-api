//app/api/admin/categories/[id]/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Category } from '@/app/db/models';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

function toSlug(s='') {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-');
}

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    requireAdmin();
    const item = await Category.findById(params.id).lean();
    if (!item) throw new BadRequestError('Kategori tidak ditemukan');
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

    const doc = await Category.findById(params.id);
    if (!doc) throw new BadRequestError('Kategori tidak ditemukan');

    if (body.name !== undefined) doc.name = body.name;
    if (body.slug !== undefined) doc.slug = body.slug || toSlug(doc.name);
    if (body.order !== undefined) doc.order = Number(body.order) || 0;
       if (body.image !== undefined) {
             // Normalisasi image → string URL
             const image =
               typeof body.image === 'string'
                 ? body.image
                 : Array.isArray(body.image)
                   ? (typeof body.image[0] === 'string' ? body.image[0] : body.image[0]?.url)
                   : body.image?.url || '';
            doc.image = image;
           }

    // ubah parent ⇒ perlu rebuild ancestors
    if (body.parent_id !== undefined) {
      let parent = null; let ancestors = [];
      if (body.parent_id) {
        parent = await Category.findById(body.parent_id).lean();
        if (!parent) throw new BadRequestError('Parent tidak ditemukan');
        ancestors = [...(parent.ancestors || []), { _id: parent._id, name: parent.name, slug: parent.slug }];
      }
      doc.parent_id = parent ? parent._id : null;
      doc.ancestors = ancestors;
      // NOTE: tidak auto-update anak-anaknya; bisa ditambah job recursive bila perlu.
    }

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
    // NOTE: Pastikan tidak punya anak (atau lakukan cascading manual)
    const hasChild = await Category.exists({ parent_id: params.id });
    if (hasChild) return json({ error: 'Masih ada subkategori. Hapus/relokasi dulu.' }, { status: 400 });

    await Category.findByIdAndDelete(params.id);
    return json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
