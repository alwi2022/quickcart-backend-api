export const runtime = 'nodejs';

import mongoose from 'mongoose';
import { dbConnect } from '@/app/db/config/mongoose';
import { Cart, Inventory, Order, Payment } from '@/app/db/models';
import { makeOrderNo } from '@/app/db/utils/makeOrderNo';

export async function POST(request) {
  await dbConnect();
  const body = await request.json();
  // body: { userId?, sessionId?, shippingAddress, billingAddress?, paymentMethod, courier, service }

  const filter = body.userId ? { userId: body.userId } : { sessionId: body.sessionId };
  if (!filter.userId && !filter.sessionId) {
    return new Response(JSON.stringify({ message: 'userId atau sessionId wajib' }), { status: 400 });
  }

  const cart = await Cart.findOne(filter).lean();
  if (!cart || cart.items.length === 0) {
    return new Response(JSON.stringify({ message: 'Cart kosong' }), { status: 400 });
  }

  const subtotal = cart.items.reduce((s, i) => s + i.priceSnapshot.unit * i.qty, 0);
  const shippingCost = 25000;
  const grandTotal = subtotal + shippingCost;

  const session = await mongoose.startSession();
  try {
    let createdOrder;
    await session.withTransaction(async () => {
      // Reserve stok
      for (const it of cart.items) {
        const inv = await Inventory.findOne({ productId: it.productId, variantId: it.variantId }).session(session);
        if (!inv) throw new Error('Inventory not found');
        const available = (inv.onHand || 0) - (inv.reserved || 0);
        if (available < it.qty) throw new Error(`Stok kurang untuk ${it.sku || it.variantId}`);
        inv.reserved += it.qty;
        await inv.save({ session });
      }

      // Buat Order
      const orderNo = makeOrderNo();
      const orderDocs = await Order.create([{
        orderNo,
        userId: body.userId || null,
        status: 'awaiting_payment',
        channel: 'web',
        items: cart.items.map(i => ({
          productId: i.productId,
          variantId: i.variantId,
          sku: i.sku,
          title: i.title,
          variantLabel: i.variantLabel,
          qty: i.qty,
          price: { currency: i.priceSnapshot.currency, unit: i.priceSnapshot.unit, subtotal: i.priceSnapshot.unit * i.qty }
        })),
        pricing: { subtotal, discounts: [], shippingCost, tax: 0, grandTotal },
        shippingAddress: body.shippingAddress,
        billingAddress: body.billingAddress || body.shippingAddress,
        payment: { method: body.paymentMethod, status: 'pending' },
        shipment: { courier: body.courier, service: body.service },
        placedAt: new Date()
      }], { session });

      createdOrder = orderDocs[0];

      // Payment record (dummy/pending)
      await Payment.create([{
        orderId: createdOrder._id,
        provider: 'Manual',
        method: body.paymentMethod,
        amount: grandTotal,
        status: 'pending',
        externalRef: `CHK-${createdOrder.orderNo}`
      }], { session });

      // Hapus cart
      await Cart.deleteOne(filter).session(session);
    });

    return Response.json({ orderId: createdOrder._id, orderNo: createdOrder.orderNo, grandTotal });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ message: err.message || 'Checkout gagal' }), { status: 400 });
  } finally {
    session.endSession();
  }
}
