export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Cart from '@/app/db/models/Cart';
import Order from '@/app/db/models/Order';
import Payment from '@/app/db/models/Payment';
import User from '@/app/db/models/User';
import { makeOrderNo } from '@/app/db/utils/makeOrderNo';
import { BadRequestError, handleApiError, json } from '@/app/db/utils/errors';
import { requireUser } from '../_guard';

type AddressInput = {
  receiverName?: string;
  phone?: string;
  street?: string;
  subdistrict?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
};

type CheckoutBody = {
  shippingAddress?: AddressInput;
  billingAddress?: AddressInput;
  paymentMethod?: string;
  courier?: string;
  service?: string;
  shippingCost?: number;
  tax?: number;
};

type CartItem = {
  productId?: string;
  variantId?: string;
  sku?: string;
  title?: string;
  variantLabel?: string;
  productImage?: string;
  brand?: string;
  category?: string;
  qty: number;
  priceSnapshot?: { currency?: string; unit?: number };
};

type CartLean = {
  _id?: unknown;
  items?: CartItem[];
};

type UserAddress = {
  _id?: unknown;
  receiver_name?: string;
  phone?: string;
  street?: string;
  subdistrict?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
};

type UserLean = {
  default_address_id?: unknown;
  addresses?: UserAddress[];
};

function normalizeAddress(input?: AddressInput | null): AddressInput | null {
  if (!input) return null;
  const receiverName = String(input.receiverName || '').trim();
  const phone = String(input.phone || '').trim();
  const street = String(input.street || '').trim();
  const subdistrict = String(input.subdistrict || '').trim();
  const city = String(input.city || '').trim();
  const province = String(input.province || '').trim();
  const postalCode = String(input.postalCode || '').trim();
  const country = String(input.country || 'ID').trim() || 'ID';

  if (!receiverName || !phone || !street || !subdistrict || !city || !province || !postalCode) {
    return null;
  }

  return { receiverName, phone, street, subdistrict, city, province, postalCode, country };
}

function mapUserAddress(address?: UserAddress | null): AddressInput | null {
  if (!address) return null;
  return normalizeAddress({
    receiverName: address.receiver_name,
    phone: address.phone,
    street: address.street,
    subdistrict: address.subdistrict,
    city: address.city,
    province: address.province,
    postalCode: address.postal_code,
    country: address.country,
  });
}

async function resolveDefaultAddress(userId: string): Promise<AddressInput | null> {
  const user = ((await User.findById(userId).select('default_address_id addresses').lean()) as unknown) as UserLean | null;
  if (!user) return null;

  const addresses = Array.isArray(user.addresses) ? user.addresses : [];
  if (!addresses.length) return null;

  const defaultId = user.default_address_id ? String(user.default_address_id) : '';
  const selected = addresses.find((addr) => String(addr._id || '') === defaultId) || addresses[0];
  return mapUserAddress(selected);
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const user = await requireUser();
    const body = (await request.json()) as CheckoutBody;

    const cart = ((await Cart.findOne({ userId: user.sub }).lean()) as unknown) as CartLean | null;
    const cartItems = Array.isArray(cart?.items)
      ? cart.items.filter((item) => Number(item.qty || 0) > 0)
      : [];

    if (!cartItems.length) {
      throw new BadRequestError('Cart kosong');
    }

    const shippingAddress = normalizeAddress(body.shippingAddress) || (await resolveDefaultAddress(String(user.sub)));
    if (!shippingAddress) {
      throw new BadRequestError('Alamat pengiriman belum tersedia');
    }

    const billingAddress = normalizeAddress(body.billingAddress) || shippingAddress;

    const subtotal = cartItems.reduce((sum, item) => {
      const unit = Number(item.priceSnapshot?.unit || 0);
      return sum + unit * Number(item.qty || 0);
    }, 0);

    const shippingCost = Math.max(0, Number(body.shippingCost ?? 0));
    const tax = Math.max(0, Number(body.tax ?? Math.floor(subtotal * 0.02)));
    const grandTotal = subtotal + shippingCost + tax;

    const orderNo = makeOrderNo();

    const order = await Order.create({
      orderNo,
      userId: user.sub,
      status: 'awaiting_payment',
      channel: 'web',
      items: cartItems.map((item) => {
        const unit = Number(item.priceSnapshot?.unit || 0);
        const qty = Number(item.qty || 0);
        return {
          productId: String(item.productId || ''),
          variantId: String(item.variantId || ''),
          sku: item.sku || '',
          title: item.title || 'Produk',
          variantLabel: item.variantLabel || '',
          productImage: item.productImage || '',
          brand: item.brand || '',
          category: item.category || '',
          qty,
          price: {
            currency: item.priceSnapshot?.currency || 'IDR',
            unit,
            subtotal: unit * qty,
          },
          weightGram: 0,
        };
      }),
      pricing: {
        subtotal,
        discounts: [],
        shippingCost,
        tax,
        grandTotal,
      },
      shippingAddress,
      billingAddress,
      payment: {
        method: body.paymentMethod || 'manual',
        status: 'pending',
      },
      shipment: {
        courier: body.courier || '',
        service: body.service || '',
      },
      placedAt: new Date(),
    });

    await Payment.create({
      orderId: order._id,
      provider: 'Manual',
      method: body.paymentMethod || 'manual',
      amount: grandTotal,
      status: 'pending',
      externalRef: `CHK-${orderNo}`,
    });

    await Cart.deleteOne({ userId: user.sub });

    return json(
      {
        item: {
          _id: order._id,
          orderNo,
          grandTotal,
        },
      },
      { status: 201 },
    );
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
