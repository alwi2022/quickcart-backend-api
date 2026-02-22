export const runtime = 'nodejs';

import mongoose from 'mongoose';
import { dbConnect } from '@/app/db/config/mongoose';
import Review from '@/app/db/models/Review';
import Product from '@/app/db/models/Product';

type ReviewCreateBody = {
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  content?: string;
  status?: string;
};

type RatingAggregateRow = {
  _id: unknown;
  avg: number;
  count: number;
};

export async function POST(request: Request) {
  await dbConnect();
  const body = (await request.json()) as ReviewCreateBody;

  const review = await Review.create(body);

  const productId = new mongoose.Types.ObjectId(body.productId);
  const agg = ((await Review.aggregate([
    { $match: { productId, status: 'published' } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])) as unknown) as RatingAggregateRow[];

  const score = agg[0] || { avg: 0, count: 0 };
  await Product.findByIdAndUpdate(productId, {
    $set: { 'rating.avg': score.avg || 0, 'rating.count': score.count || 0 },
  });

  return Response.json(review, { status: 201 });
}

