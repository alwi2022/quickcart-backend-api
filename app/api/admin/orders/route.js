// app/api/admin/orders/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Order, User } from '@/app/db/models';
import { handleApiError, json } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

export async function GET(request) {
  try {
    await dbConnect();
    requireAdmin();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (from || to) {
      filter.placedAt = {};
      if (from) filter.placedAt.$gte = new Date(from);
      if (to) filter.placedAt.$lte = new Date(to);
    }
    if (q) {
      // cari by orderNo langsung; kalau bentuk email, cari userId by email
      filter.$or = [{ orderNo: new RegExp(q, 'i') }];
      const u = await User.findOne({ email: new RegExp(`^${q}$`, 'i') }).select('_id').lean();
      if (u) filter.$or.push({ userId: u._id });
    }

    const [items, total] = await Promise.all([
      Order.find(filter).sort({ placedAt: -1 }).skip(skip).limit(limit)
        .select('orderNo status pricing placedAt userId payment.status shipment.trackingNo')
        .lean(),
      Order.countDocuments(filter),
    ]);

    // enrich user email
    const userIds = [...new Set(items.map(i => String(i.userId)))];
    const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('email name').lean() : [];
    const umap = new Map(users.map(u => [String(u._id), { email: u.email, name: u.name }]));

    const mapped = items.map(o => ({
      ...o,
      user: umap.get(String(o.userId)) || null,
      total: o.pricing?.grandTotal ?? 0,
    }));

    return json({ items: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    return handleApiError(e);
  }
}
