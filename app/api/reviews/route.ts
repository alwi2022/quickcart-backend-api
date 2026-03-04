export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Review from '@/app/db/models/Review';
import User from '@/app/db/models/User';
import { requireUser } from '../_guard';
import { BadRequestError, handleApiError, json } from '@/app/db/utils/errors';

type ReviewCreateBody = {
  productId?: string;
  rating?: number;
  title?: string;
  content?: string;
};

type ReviewDoc = {
  _id?: unknown;
  product_id?: string;
  user_id?: string;
  rating?: number;
  title?: string;
  content?: string;
  status?: string;
  createdAt?: string;
};

type UserLite = {
  _id?: unknown;
  name?: string;
  email?: string;
};

function sanitize(value: unknown): string {
  return String(value || '').trim();
}

function toRating(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const productId = sanitize(searchParams.get('productId'));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || 20)));

    if (!productId) throw new BadRequestError('productId wajib diisi');

    const rows = ((await Review.find({ product_id: productId, status: 'published' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()) as unknown) as ReviewDoc[];

    const userIds = [...new Set(rows.map((row) => sanitize(row.user_id)).filter(Boolean))];
    const users = ((await User.find({ _id: { $in: userIds } }).select('name email').lean()) as unknown) as UserLite[];
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const items = rows.map((row) => {
      const user = userMap.get(sanitize(row.user_id));
      return {
        _id: row._id,
        productId: row.product_id,
        rating: Number(row.rating || 0),
        title: row.title || '',
        content: row.content || '',
        status: row.status || 'published',
        createdAt: row.createdAt,
        user: {
          _id: row.user_id,
          name: user?.name || user?.email || 'User',
        },
      };
    });

    return json({ items });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const auth = await requireUser();

    const body = (await request.json()) as ReviewCreateBody;
    const productId = sanitize(body.productId);
    const rating = toRating(body.rating);

    if (!productId) throw new BadRequestError('productId wajib diisi');
    if (!rating) throw new BadRequestError('rating wajib diisi');

    const review = await Review.create({
      product_id: productId,
      user_id: auth.sub,
      rating,
      title: sanitize(body.title),
      content: sanitize(body.content),
      status: 'published',
    });

    const user = ((await User.findById(auth.sub).select('name email').lean()) as unknown) as UserLite | null;

    return json(
      {
        item: {
          _id: review._id,
          productId,
          rating,
          title: sanitize(body.title),
          content: sanitize(body.content),
          status: 'published',
          createdAt: review.createdAt,
          user: {
            _id: auth.sub,
            name: user?.name || user?.email || 'User',
          },
        },
      },
      { status: 201 },
    );
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
