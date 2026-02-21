// app/api/orders/[id]/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Order, Inventory } from '@/app/db/models';
import { handleApiError, json, BadRequestError, UnauthorizedError } from '@/app/db/utils/errors';
import { requireUser } from '../../_guard';

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    const u = requireUser();

    const doc = await Order.findById(params.id).lean();
    if (!doc) throw new BadRequestError('Order tidak ditemukan');
    if (String(doc.userId) !== String(u.sub)) throw new UnauthorizedError('Tidak boleh akses order orang lain');

    return json({ item: doc });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    const u = requireUser();
    const body = await request.json();

    const doc = await Order.findById(params.id);
    if (!doc) throw new BadRequestError('Order tidak ditemukan');
    if (String(doc.userId) !== String(u.sub)) throw new UnauthorizedError('Tidak boleh akses order orang lain');

    // Cancel order (contoh rule: hanya awaiting_payment)
    if (body?.action === 'cancel') {
      if (doc.status !== 'awaiting_payment') throw new BadRequestError('Order tidak bisa dibatalkan');
      doc.status = 'cancelled';
      await doc.save();

      // OPTIONAL: kembalikan stok
      if (Array.isArray(doc.items)) {
        await Promise.all(doc.items.map(it => Inventory.updateOne(
          { product_id: it.productId, variant_id: it.variantId, sku: it.sku, warehouse: 'main' },
          { $inc: { qty: it.qty } }
        )));
      }

      return json({ item: { _id: doc._id, status: doc.status } });
    }

    // aksi lain (ubah alamat sebelum bayar, dsb) bisa ditambah di sini
    return json({ error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
