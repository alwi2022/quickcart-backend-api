// app/api/orders/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Product, Order } from '@/app/db/models';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { createOrderSchema } from '@/app/db/utils/validators';
import { getActiveUnitPrice } from '@/app/db/utils/pricing';
import { makeOrderNo } from '@/app/db/utils/makeOrderNo';
import { reserveInventoryOrThrow } from '@/app/db/utils/inventory';
import { requireUser } from '../_guard';

export async function GET(request) {
  try {
    await dbConnect();
    const u = requireUser();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Order.find({ userId: u.sub })
        .sort({ placedAt: -1 })
        .skip(skip).limit(limit)
        .select('orderNo status pricing placedAt items payment.shipment')
        .lean(),
      Order.countDocuments({ userId: u.sub })
    ]);

    return json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    const u = requireUser();

    const body = await request.json();
    const data = createOrderSchema.parse(body);

    // ambil produk+varian untuk snapshot & harga
    const prodIds = [...new Set(data.items.map(i => i.productId))];
    const prods = await Product.find({ _id: { $in: prodIds } }).lean();

    const items = data.items.map(it => {
      const p = prods.find(pp => String(pp._id) === String(it.productId));
      if (!p) throw new BadRequestError(`Produk tidak ditemukan: ${it.productId}`);
      const v = (p.variants || []).find(vv => String(vv._id) === String(it.variantId));
      if (!v) throw new BadRequestError(`Varian tidak ditemukan untuk produk ${p.title}`);

      const unit = getActiveUnitPrice(v);
      const subtotal = unit * it.qty;

      return {
        productId: p._id,
        variantId: v._id,
        sku: v.sku,
        title: p.title,
        variantLabel: [v.options?.color, v.options?.size].filter(Boolean).join(' / '),
        qty: it.qty,
        price: { currency: v.price?.currency || 'IDR', unit, subtotal },
        weightGram: v.weightGram ?? 0,
      };
    });

    const subtotal = items.reduce((s, it) => s + it.price.subtotal, 0);
    const shippingCost = Number(data.shippingCost || 0);
    const tax = Number(data.tax || 0);
    const discounts = []; // TODO: kalkulasi kupon kalau ada
    const grandTotal = subtotal + shippingCost + tax - discounts.reduce((s, d) => s + (d.amount || 0), 0);

    // Cek & kurangi stok
    await reserveInventoryOrThrow(items);

    // Buat order
    const orderNo = await makeOrderNo();
    const doc = await Order.create({
      orderNo,
      userId: u.sub,
      status: 'awaiting_payment',
      channel: data.channel || 'web',
      items,
      pricing: { subtotal, discounts, shippingCost, tax, grandTotal },
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress || data.shippingAddress,
      payment: { method: data.paymentMethod || 'manual', status: 'pending' },
      shipment: {},
      placedAt: new Date(),
    });

    return json({ item: doc }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
