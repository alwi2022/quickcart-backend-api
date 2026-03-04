export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Wishlist from '@/app/db/models/Wishlist';
import { requireUser } from '../_guard';
import { BadRequestError, handleApiError, json } from '@/app/db/utils/errors';

type WishlistBody = {
  productId?: string;
  productIds?: string[];
  op?: 'add' | 'remove' | 'clear' | 'replace';
};

type WishlistItem = {
  productId?: string;
};

type WishlistDoc = {
  items: WishlistItem[];
  save: () => Promise<unknown>;
};

function sanitizeProductId(value: unknown): string {
  return String(value || '').trim();
}

export async function GET() {
  try {
    await dbConnect();
    const user = await requireUser();

    const wl = await Wishlist.findOne({ userId: user.sub }).lean();
    return json(wl || { items: [] });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const user = await requireUser();

    const { productId, productIds, op } = (await request.json()) as WishlistBody;
    if (!op) throw new BadRequestError('op wajib diisi');

    let wl = ((await Wishlist.findOne({ userId: user.sub })) as unknown) as WishlistDoc | null;
    if (!wl) wl = (new Wishlist({ userId: user.sub, items: [] }) as unknown) as WishlistDoc;

    if (op === 'clear') {
      wl.items = [];
      await wl.save();
      return json(wl);
    }

    if (op === 'replace') {
      const source = Array.isArray(productIds) ? productIds : [];
      const dedup = [...new Set(source.map((it) => sanitizeProductId(it)).filter(Boolean))];
      wl.items = dedup.map((id) => ({ productId: id }));
      await wl.save();
      return json(wl);
    }

    const pid = sanitizeProductId(productId);
    if (!pid) throw new BadRequestError('productId wajib diisi');

    if (op === 'add') {
      const exists = wl.items.some((item) => sanitizeProductId(item.productId) === pid);
      if (!exists) wl.items.push({ productId: pid });
      await wl.save();
      return json(wl);
    }

    if (op === 'remove') {
      wl.items = wl.items.filter((item) => sanitizeProductId(item.productId) !== pid);
      await wl.save();
      return json(wl);
    }

    throw new BadRequestError('op tidak dikenali');
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
