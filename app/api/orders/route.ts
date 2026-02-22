export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Product from '@/app/db/models/Product';
import Order from '@/app/db/models/Order';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { createOrderSchema } from '@/app/db/utils/validators';
import { getActiveUnitPrice } from '@/app/db/utils/pricing';
import { makeOrderNo } from '@/app/db/utils/makeOrderNo';
import { reserveInventoryOrThrow } from '@/app/db/utils/inventory';
import { requireUser } from '../_guard';

type ProductVariantLean = {
  _id: unknown;
  sku?: string;
  options?: { color?: string; size?: string };
  price?: { currency?: string; list?: number | string; sale?: number | string | null };
  weightGram?: number | null;
};

type ProductLean = {
  _id: unknown;
  title: string;
  variants?: ProductVariantLean[];
};

type OrderItemPayload = {
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  variantLabel: string;
  qty: number;
  price: { currency: string; unit: number; subtotal: number };
  weightGram: number;
};

type Discount = {
  code?: string;
  amount: number;
};

export async function GET(request: Request) {
  try {
    await dbConnect();
    const user = await requireUser();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Order.find({ userId: user.sub })
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('orderNo status pricing placedAt items payment.shipment')
        .lean(),
      Order.countDocuments({ userId: user.sub }),
    ]);

    return json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const user = await requireUser();

    const body = await request.json();
    const data = createOrderSchema.parse(body);

    const prodIds = [...new Set(data.items.map((item) => item.productId))];
    const products = ((await Product.find({ _id: { $in: prodIds } }).lean()) as unknown) as ProductLean[];

    const items: OrderItemPayload[] = data.items.map((item) => {
      const product = products.find((it) => String(it._id) === String(item.productId));
      if (!product) throw new BadRequestError(`Produk tidak ditemukan: ${item.productId}`);

      const variant = (product.variants || []).find((it) => String(it._id) === String(item.variantId));
      if (!variant) throw new BadRequestError(`Varian tidak ditemukan untuk produk ${product.title}`);

      const unit = getActiveUnitPrice(variant);
      const subtotal = unit * item.qty;

      return {
        productId: String(product._id),
        variantId: String(variant._id),
        sku: variant.sku || '',
        title: product.title,
        variantLabel: [variant.options?.color, variant.options?.size].filter(Boolean).join(' / '),
        qty: item.qty,
        price: { currency: variant.price?.currency || 'IDR', unit, subtotal },
        weightGram: variant.weightGram ?? 0,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price.subtotal, 0);
    const shippingCost = Number(data.shippingCost || 0);
    const tax = Number(data.tax || 0);
    const discounts: Discount[] = [];
    const grandTotal = subtotal + shippingCost + tax - discounts.reduce((sum, it) => sum + it.amount, 0);

    await reserveInventoryOrThrow(items);

    const orderNo = await makeOrderNo();
    const doc = await Order.create({
      orderNo,
      userId: user.sub,
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
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

