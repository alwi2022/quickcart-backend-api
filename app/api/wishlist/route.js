export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Wishlist } from '@/app/db/models';

export async function GET(request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return new Response(JSON.stringify({ message: 'userId wajib' }), { status: 400 });
  const wl = await Wishlist.findOne({ userId }).lean();
  return Response.json(wl || { items: [] });
}

export async function PUT(request) {
  await dbConnect();
  const { userId, productId, op } = await request.json(); // op: 'add'|'remove'
  if (!userId || !productId) return new Response(JSON.stringify({ message: 'userId & productId wajib' }), { status: 400 });

  let wl = await Wishlist.findOne({ userId });
  if (!wl) wl = new Wishlist({ userId, items: [] });

  if (op === 'add') {
    const exists = wl.items.some(i => String(i.productId) === String(productId));
    if (!exists) wl.items.push({ productId });
  } else if (op === 'remove') {
    wl.items = wl.items.filter(i => String(i.productId) !== String(productId));
  }

  await wl.save();
  return Response.json(wl);
}
