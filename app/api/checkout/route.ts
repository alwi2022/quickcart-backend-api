export const runtime = 'nodejs';

import mongoose from 'mongoose';
import { dbConnect } from '@/app/db/config/mongoose';
import Cart from '@/app/db/models/Cart';
import Inventory from '@/app/db/models/Inventory';
import Order from '@/app/db/models/Order';
import Payment from '@/app/db/models/Payment';
import { makeOrderNo } from '@/app/db/utils/makeOrderNo';

type CheckoutBody = {
  userId?: string;
  sessionId?: string;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  paymentMethod?: string;
  courier?: string;
  service?: string;
};

type CartFilter = { userId?: string; sessionId?: string };

type CartItem = {
  productId: unknown;
  variantId: unknown;
  sku?: string;
  title?: string;
  variantLabel?: string;
  qty: number;
  priceSnapshot: { currency?: string; unit: number };
};

type CartLean = {
  items: CartItem[];
};

type InventoryDoc = {
  onHand?: number;
  reserved?: number;
  save: (opts?: { session?: mongoose.ClientSession }) => Promise<unknown>;
};

type CreatedOrder = {
  _id: unknown;
  orderNo: string;
};

function buildFilter(body: CheckoutBody): CartFilter {
  if (body.userId) return { userId: body.userId };
  if (body.sessionId) return { sessionId: body.sessionId };
  return {};
}

function isValidFilter(filter: CartFilter): boolean {
  return Boolean(filter.userId || filter.sessionId);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Checkout gagal';
}

export async function POST(request: Request) {
  await dbConnect();
  const body = (await request.json()) as CheckoutBody;

  const filter = buildFilter(body);
  if (!isValidFilter(filter)) {
    return new Response(JSON.stringify({ message: 'userId atau sessionId wajib' }), { status: 400 });
  }

  const cart = ((await Cart.findOne(filter).lean()) as unknown) as CartLean | null;
  if (!cart || cart.items.length === 0) {
    return new Response(JSON.stringify({ message: 'Cart kosong' }), { status: 400 });
  }

  const subtotal = cart.items.reduce((sum, item) => sum + item.priceSnapshot.unit * item.qty, 0);
  const shippingCost = 25000;
  const grandTotal = subtotal + shippingCost;

  const session = await mongoose.startSession();
  try {
    let createdOrder: CreatedOrder | null = null;

    await session.withTransaction(async () => {
      for (const item of cart.items) {
        const inventory = ((await Inventory.findOne({
          productId: item.productId,
          variantId: item.variantId,
        }).session(session)) as unknown) as InventoryDoc | null;

        if (!inventory) throw new Error('Inventory not found');
        const available = (inventory.onHand || 0) - (inventory.reserved || 0);
        if (available < item.qty) throw new Error(`Stok kurang untuk ${item.sku || item.variantId}`);

        inventory.reserved = (inventory.reserved || 0) + item.qty;
        await inventory.save({ session });
      }

      const orderNo = makeOrderNo();
      const orderDocs = ((await Order.create(
        [
          {
            orderNo,
            userId: body.userId || null,
            status: 'awaiting_payment',
            channel: 'web',
            items: cart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              sku: item.sku,
              title: item.title,
              variantLabel: item.variantLabel,
              qty: item.qty,
              price: {
                currency: item.priceSnapshot.currency,
                unit: item.priceSnapshot.unit,
                subtotal: item.priceSnapshot.unit * item.qty,
              },
            })),
            pricing: { subtotal, discounts: [], shippingCost, tax: 0, grandTotal },
            shippingAddress: body.shippingAddress,
            billingAddress: body.billingAddress || body.shippingAddress,
            payment: { method: body.paymentMethod, status: 'pending' },
            shipment: { courier: body.courier, service: body.service },
            placedAt: new Date(),
          },
        ],
        { session },
      )) as unknown) as CreatedOrder[];

      createdOrder = orderDocs[0];

      await Payment.create(
        [
          {
            orderId: createdOrder._id,
            provider: 'Manual',
            method: body.paymentMethod,
            amount: grandTotal,
            status: 'pending',
            externalRef: `CHK-${createdOrder.orderNo}`,
          },
        ],
        { session },
      );

      await Cart.deleteOne(filter).session(session);
    });

    if (!createdOrder) {
      return new Response(JSON.stringify({ message: 'Checkout gagal' }), { status: 400 });
    }

    return Response.json({ orderId: createdOrder._id, orderNo: createdOrder.orderNo, grandTotal });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ message: getErrorMessage(err) }), { status: 400 });
  } finally {
    session.endSession();
  }
}

