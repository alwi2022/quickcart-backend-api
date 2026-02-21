export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Cart, Product } from '@/app/db/models';

export async function GET(request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const sessionId = searchParams.get('sessionId');

  const filter = userId ? { userId } : { sessionId };
  if (!userId && !sessionId) {
    return new Response(JSON.stringify({ message: 'userId atau sessionId wajib' }), { status: 400 });
  }

  const cart = await Cart.findOne(filter).lean();
  return Response.json(cart || { items: [] });
}

export async function PUT(request) {
  await dbConnect();
  const body = await request.json();
  // body: { userId or sessionId, op: 'add|remove|set', productId, variantId, qty }

  const filter = body.userId ? { userId: body.userId } : { sessionId: body.sessionId };
  if (!filter.userId && !filter.sessionId)
    return new Response(JSON.stringify({ message: 'userId atau sessionId wajib' }), { status: 400 });

  let cart = await Cart.findOne(filter);
  if (!cart) cart = new Cart(filter);

  if (body.op === 'add') {
    const idx = cart.items.findIndex(i => String(i.variantId) === String(body.variantId));
    if (idx >= 0) {
      cart.items[idx].qty += body.qty || 1;
    } else {
      const prod = await Product.findById(body.productId).lean();
      if (!prod) return new Response(JSON.stringify({ message: 'Produk tidak ditemukan' }), { status: 404 });
      const v = prod.variants.find(x => String(x._id) === String(body.variantId));
      if (!v) return new Response(JSON.stringify({ message: 'Varian tidak ditemukan' }), { status: 404 });
      cart.items.push({
        productId: body.productId,
        variantId: body.variantId,
        sku: v?.sku,
        title: prod.title,
        variantLabel: Object.values(v?.options || {}).join(' / '),
        qty: body.qty || 1,
        priceSnapshot: { currency: v?.price?.currency, unit: v?.price?.sale ?? v?.price?.list }
      });
    }
  }

  if (body.op === 'set') {
    const idx = cart.items.findIndex(i => String(i.variantId) === String(body.variantId));
    if (idx >= 0) cart.items[idx].qty = Math.max(1, Number(body.qty || 1));
  }

  if (body.op === 'remove') {
    cart.items = cart.items.filter(i => String(i.variantId) !== String(body.variantId));
  }

  await cart.save();
  return Response.json(cart);
}
