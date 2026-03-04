export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Cart from '@/app/db/models/Cart';
import { requireUser } from '../_guard';
import { BadRequestError, handleApiError, json } from '@/app/db/utils/errors';

type CartOp = 'add' | 'set' | 'remove' | 'clear' | 'replace';

type CartRequestBody = {
  op?: CartOp;
  productId?: string;
  variantId?: string;
  sku?: string;
  title?: string;
  variantLabel?: string;
  productImage?: string;
  brand?: string;
  category?: string;
  qty?: number;
  price?: number;
  currency?: string;
  items?: Array<{
    productId?: string;
    variantId?: string;
    sku?: string;
    title?: string;
    variantLabel?: string;
    productImage?: string;
    brand?: string;
    category?: string;
    qty?: number;
    price?: number;
    currency?: string;
  }>;
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

type CartDoc = {
  items: CartItem[];
  save: () => Promise<unknown>;
};

function toPositiveInt(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function keyOf(productId?: string, variantId?: string): string {
  return `${String(productId || '')}::${String(variantId || '')}`;
}

function sanitizeText(value: unknown): string {
  return String(value || '').trim();
}

export async function GET() {
  try {
    await dbConnect();
    const user = await requireUser();

    const cart = await Cart.findOne({ userId: user.sub }).lean();
    return json(cart || { items: [] });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const user = await requireUser();

    const body = (await request.json()) as CartRequestBody;
    const op = body.op;
    if (!op) throw new BadRequestError('op wajib diisi');

    const productId = sanitizeText(body.productId);
    const variantId = sanitizeText(body.variantId);

    let cart = ((await Cart.findOne({ userId: user.sub })) as unknown) as CartDoc | null;
    if (!cart) cart = (new Cart({ userId: user.sub, items: [] }) as unknown) as CartDoc;

    if (op === 'clear') {
      cart.items = [];
      await cart.save();
      return json(cart);
    }

    if (op === 'replace') {
      const source = Array.isArray(body.items) ? body.items : [];
      cart.items = source
        .map((item) => ({
          productId: sanitizeText(item.productId) || undefined,
          variantId: sanitizeText(item.variantId) || undefined,
          sku: sanitizeText(item.sku) || undefined,
          title: sanitizeText(item.title) || undefined,
          variantLabel: sanitizeText(item.variantLabel) || undefined,
          productImage: sanitizeText(item.productImage) || undefined,
          brand: sanitizeText(item.brand) || undefined,
          category: sanitizeText(item.category) || undefined,
          qty: toPositiveInt(item.qty, 1),
          priceSnapshot: {
            currency: sanitizeText(item.currency) || 'IDR',
            unit: Number(item.price || 0),
          },
        }))
        .filter((item) => item.productId && item.qty > 0);
      await cart.save();
      return json(cart);
    }

    if (!productId) throw new BadRequestError('productId wajib diisi');

    const itemKey = keyOf(productId, variantId);
    const index = cart.items.findIndex((item) => keyOf(item.productId, item.variantId) === itemKey);

    if (op === 'remove') {
      cart.items = cart.items.filter((item) => keyOf(item.productId, item.variantId) !== itemKey);
      await cart.save();
      return json(cart);
    }

    const qty = toPositiveInt(body.qty, 1);
    const unitPrice = Number(body.price || 0);

    if (op === 'add') {
      if (index >= 0) {
        cart.items[index].qty = toPositiveInt(cart.items[index].qty, 1) + qty;
      } else {
        cart.items.push({
          productId,
          variantId: variantId || undefined,
          sku: sanitizeText(body.sku) || undefined,
          title: sanitizeText(body.title) || undefined,
          variantLabel: sanitizeText(body.variantLabel) || undefined,
          productImage: sanitizeText(body.productImage) || undefined,
          brand: sanitizeText(body.brand) || undefined,
          category: sanitizeText(body.category) || undefined,
          qty,
          priceSnapshot: {
            currency: sanitizeText(body.currency) || 'IDR',
            unit: Number.isFinite(unitPrice) ? unitPrice : 0,
          },
        });
      }
      await cart.save();
      return json(cart);
    }

    if (op === 'set') {
      if (qty <= 0) {
        cart.items = cart.items.filter((item) => keyOf(item.productId, item.variantId) !== itemKey);
        await cart.save();
        return json(cart);
      }

      if (index >= 0) {
        cart.items[index].qty = qty;
        if (sanitizeText(body.title)) cart.items[index].title = sanitizeText(body.title);
        if (sanitizeText(body.productImage)) cart.items[index].productImage = sanitizeText(body.productImage);
        if (sanitizeText(body.brand)) cart.items[index].brand = sanitizeText(body.brand);
        if (sanitizeText(body.category)) cart.items[index].category = sanitizeText(body.category);
        if (Number.isFinite(unitPrice)) {
          cart.items[index].priceSnapshot = {
            currency: sanitizeText(body.currency) || cart.items[index].priceSnapshot?.currency || 'IDR',
            unit: unitPrice,
          };
        }
      } else {
        cart.items.push({
          productId,
          variantId: variantId || undefined,
          sku: sanitizeText(body.sku) || undefined,
          title: sanitizeText(body.title) || undefined,
          variantLabel: sanitizeText(body.variantLabel) || undefined,
          productImage: sanitizeText(body.productImage) || undefined,
          brand: sanitizeText(body.brand) || undefined,
          category: sanitizeText(body.category) || undefined,
          qty,
          priceSnapshot: {
            currency: sanitizeText(body.currency) || 'IDR',
            unit: Number.isFinite(unitPrice) ? unitPrice : 0,
          },
        });
      }

      await cart.save();
      return json(cart);
    }

    throw new BadRequestError('op tidak dikenali');
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
