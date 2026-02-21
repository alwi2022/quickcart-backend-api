export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Product, Review } from '@/app/db/models';

export async function GET(_req, { params }) {
  await dbConnect();
  const { slug } = params;

  const prod = await Product.findOne({ slug, status: 'active' }).lean();
  if (!prod) return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });

  // Ambil 10 ulasan terbaru yang published
  const reviews = await Review.find({ productId: prod._id, status: 'published' })
    .sort('-createdAt')
    .limit(10)
    .lean();

  return Response.json({ product: prod, reviews });
}
