export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Review, Product } from '@/app/db/models';
import mongoose from 'mongoose';

export async function POST(request) {
  await dbConnect();
  const body = await request.json();
  // body: { productId, userId, rating, title?, content?, status? }

  const review = await Review.create(body);

  // Recalc rating (published only)
  const productId = new mongoose.Types.ObjectId(body.productId);
  const agg = await Review.aggregate([
    { $match: { productId, status: 'published' } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const score = agg[0] || { avg: 0, count: 0 };
  await Product.findByIdAndUpdate(productId, {
    $set: { 'rating.avg': score.avg || 0, 'rating.count': score.count || 0 }
  });

  return Response.json(review, { status: 201 });
}
