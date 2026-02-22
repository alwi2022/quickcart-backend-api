export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Cart from '@/app/db/models/Cart';
import Product from '@/app/db/models/Product';

type CartFilter = { userId?: string; sessionId?: string };
type CartOp = 'add' | 'set' | 'remove';

type CartRequestBody = {
  userId?: string;
  sessionId?: string;
  op?: CartOp;
  productId?: string;
  variantId?: string;
  qty?: number;
};

type ProductVariant = {
  _id: unknown;
  sku?: string;
  options?: Record<string, unknown>;
  price?: { currency?: string; sale?: number | string | null; list?: number | string };
};

type ProductLike = {
  title?: string;
  variants?: ProductVariant[];
};

type CartItem = {
  productId?: string;
  variantId?: string;
  sku?: string;
  title?: string;
  variantLabel?: string;
  qty: number;
  priceSnapshot?: { currency?: string; unit?: number | string | null };
};

type CartDoc = {
  items: CartItem[];
  save: () => Promise<unknown>;
};

function buildFilter(body: CartRequestBody): CartFilter {
  if (body.userId) return { userId: body.userId };
  if (body.sessionId) return { sessionId: body.sessionId };
  return {};
}

function isValidFilter(filter: CartFilter): boolean {
  return Boolean(filter.userId || filter.sessionId);
}

function toVariantLabel(options?: Record<string, unknown>): string {
  return Object.values(options || {})
    .map((value) => (value == null ? '' : String(value)))
    .filter(Boolean)
    .join(' / ');
}

export async function GET(request: Request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const filter = buildFilter({
    userId: searchParams.get('userId') || undefined,
    sessionId: searchParams.get('sessionId') || undefined,
  });

  if (!isValidFilter(filter)) {
    return new Response(JSON.stringify({ message: 'userId atau sessionId wajib' }), { status: 400 });
  }

  const cart = await Cart.findOne(filter).lean();
  return Response.json(cart || { items: [] });
}

export async function PUT(request: Request) {
  await dbConnect();
  const body = (await request.json()) as CartRequestBody;
  const filter = buildFilter(body);

  if (!isValidFilter(filter)) {
    return new Response(JSON.stringify({ message: 'userId atau sessionId wajib' }), { status: 400 });
  }
  if (!body.variantId) {
    return new Response(JSON.stringify({ message: 'variantId wajib' }), { status: 400 });
  }

  let cart = ((await Cart.findOne(filter)) as unknown) as CartDoc | null;
  if (!cart) cart = (new Cart(filter) as unknown) as CartDoc;

  if (body.op === 'add') {
    const idx = cart.items.findIndex((item) => String(item.variantId) === String(body.variantId));
    if (idx >= 0) {
      cart.items[idx].qty += body.qty || 1;
    } else {
      const product = ((await Product.findById(body.productId).lean()) as unknown) as ProductLike | null;
      if (!product) {
        return new Response(JSON.stringify({ message: 'Produk tidak ditemukan' }), { status: 404 });
      }
      const variant = (product.variants || []).find((it) => String(it._id) === String(body.variantId));
      if (!variant) {
        return new Response(JSON.stringify({ message: 'Varian tidak ditemukan' }), { status: 404 });
      }

      cart.items.push({
        productId: body.productId,
        variantId: body.variantId,
        sku: variant.sku,
        title: product.title,
        variantLabel: toVariantLabel(variant.options),
        qty: body.qty || 1,
        priceSnapshot: {
          currency: variant.price?.currency,
          unit: variant.price?.sale ?? variant.price?.list,
        },
      });
    }
  }

  if (body.op === 'set') {
    const idx = cart.items.findIndex((item) => String(item.variantId) === String(body.variantId));
    if (idx >= 0) cart.items[idx].qty = Math.max(1, Number(body.qty || 1));
  }

  if (body.op === 'remove') {
    cart.items = cart.items.filter((item) => String(item.variantId) !== String(body.variantId));
  }

  await cart.save();
  return Response.json(cart);
}

