export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Order from '@/app/db/models/Order';
import User from '@/app/db/models/User';
import { handleApiError, json } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

type AdminOrderFilter = {
  status?: string;
  placedAt?: { $gte?: Date; $lte?: Date };
  $or?: Array<{ orderNo?: RegExp; userId?: unknown }>;
};

type AdminOrderRow = {
  userId: unknown;
  pricing?: { grandTotal?: number };
} & Record<string, unknown>;

type AdminUserRow = {
  _id: unknown;
  email?: string;
  name?: string;
};

export async function GET(request: Request) {
  try {
    await dbConnect();
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
    const skip = (page - 1) * limit;

    const filter: AdminOrderFilter = {};
    if (status) filter.status = status;
    if (from || to) {
      filter.placedAt = {};
      if (from) filter.placedAt.$gte = new Date(from);
      if (to) filter.placedAt.$lte = new Date(to);
    }

    if (q) {
      filter.$or = [{ orderNo: new RegExp(q, 'i') }];
      const foundUser = ((await User.findOne({ email: new RegExp(`^${q}$`, 'i') }).select('_id').lean()) as unknown) as
        | { _id: unknown }
        | null;
      if (foundUser) filter.$or.push({ userId: foundUser._id });
    }

    const [items, total] = (await Promise.all([
      Order.find(filter)
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('orderNo status pricing placedAt userId payment.status shipment.trackingNo')
        .lean(),
      Order.countDocuments(filter),
    ]) as unknown) as [AdminOrderRow[], number];

    const userIds = [...new Set(items.map((item) => String(item.userId)))];
    const users = userIds.length
      ? (((await User.find({ _id: { $in: userIds } }).select('email name').lean()) as unknown) as AdminUserRow[])
      : [];

    const userMap = new Map(users.map((user) => [String(user._id), { email: user.email, name: user.name }]));
    const mapped = items.map((order) => ({
      ...order,
      user: userMap.get(String(order.userId)) || null,
      total: order.pricing?.grandTotal ?? 0,
    }));

    return json({ items: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

