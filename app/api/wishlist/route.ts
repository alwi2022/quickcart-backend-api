export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Wishlist from '@/app/db/models/Wishlist';

type WishlistBody = {
  userId?: string;
  productId?: string;
  op?: 'add' | 'remove';
};

type WishlistItem = {
  productId: unknown;
};

type WishlistDoc = {
  items: WishlistItem[];
  save: () => Promise<unknown>;
};

export async function GET(request: Request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return new Response(JSON.stringify({ message: 'userId wajib' }), { status: 400 });
  const wl = await Wishlist.findOne({ userId }).lean();
  return Response.json(wl || { items: [] });
}

export async function PUT(request: Request) {
  await dbConnect();
  const { userId, productId, op } = (await request.json()) as WishlistBody; // op: 'add'|'remove'
  if (!userId || !productId) return new Response(JSON.stringify({ message: 'userId & productId wajib' }), { status: 400 });

  let wl = ((await Wishlist.findOne({ userId })) as unknown) as WishlistDoc | null;
  if (!wl) wl = (new Wishlist({ userId, items: [] }) as unknown) as WishlistDoc;

  if (op === 'add') {
    const exists = wl.items.some((item) => String(item.productId) === String(productId));
    if (!exists) wl.items.push({ productId });
  } else if (op === 'remove') {
    wl.items = wl.items.filter((item) => String(item.productId) !== String(productId));
  }

  await wl.save();
  return Response.json(wl);
}

