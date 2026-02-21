export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Product } from '@/app/db/models';

export async function GET(request) {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const brand = searchParams.get('brand');
    const category = searchParams.get('category');
    const sort = searchParams.get('sort') || '-updatedAt'; // 'price', '-price', '-updatedAt', etc
    const page = Number(searchParams.get('page') || 1);
    const limit = Math.min(Number(searchParams.get('limit') || 12), 48);

    const filter = { status: 'active' };
    if (q) filter.$text = { $search: q };
    if (brand) filter.brandId = brand;
    if (category) filter.categoryIds = category;

    const cursor = Product.find(filter)
        .select('slug title media variants.price rating brandId categoryIds updatedAt')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);

    const [items, total] = await Promise.all([cursor.lean(), Product.countDocuments(filter)]);

    return Response.json({ items, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(request) {
    // TODO: tambahkan auth admin sebelum production
    await dbConnect();
    const body = await request.json();
    const prod = await Product.create(body);
    return Response.json(prod, { status: 201 });
}
