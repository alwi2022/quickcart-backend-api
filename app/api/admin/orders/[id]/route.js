// app/api/admin/orders/[id]/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Order } from '@/app/db/models';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

export async function GET(_req, { params }) {
  try {
    await dbConnect();
    requireAdmin();

    const doc = await Order.findById(params.id).lean();
    if (!doc) throw new BadRequestError('Order tidak ditemukan');

    return json({ item: doc });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    requireAdmin();

    const body = await request.json();
    const doc = await Order.findById(params.id);
    if (!doc) throw new BadRequestError('Order tidak ditemukan');

    // update status order
    if (body.status) {
      const allowed = ['awaiting_payment','paid','processing','shipped','completed','cancelled','refunded'];
      if (!allowed.includes(body.status)) throw new BadRequestError('Status tidak valid');
      doc.status = body.status;
    }

    // update shipment info
    if (body.shipment) {
      doc.shipment = {
        ...doc.shipment?.toObject?.() ?? {},
        courier: body.shipment.courier ?? doc.shipment?.courier,
        service: body.shipment.service ?? doc.shipment?.service,
        trackingNo: body.shipment.trackingNo ?? doc.shipment?.trackingNo,
      };
    }

    // update payment status
    if (body.paymentStatus) {
      const ps = ['pending','paid','failed','expired'];
      if (!ps.includes(body.paymentStatus)) throw new BadRequestError('Payment status tidak valid');
      doc.payment = { ...(doc.payment?.toObject?.() ?? {}), status: body.paymentStatus };
    }

    await doc.save();
    return json({ item: { _id: doc._id, status: doc.status, payment: doc.payment, shipment: doc.shipment } });
  } catch (e) {
    return handleApiError(e);
  }
}
