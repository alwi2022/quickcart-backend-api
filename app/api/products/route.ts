export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Product from '@/app/db/models/Product';
import Brand from '@/app/db/models/Brand';
import Category from '@/app/db/models/Category';

type ProductListFilter = {
  status: 'active';
  $text?: { $search: string };
  brandId?: string;
  categoryIds?: string;
};

type ProductPrice = {
  currency?: string;
  list?: number | string;
  sale?: number | string | null;
};

type ProductVariant = {
  price?: ProductPrice;
};

type ProductMedia = {
  url?: string;
  alt?: string;
};

type ProductRow = {
  _id: unknown;
  slug?: string;
  title?: string;
  subtitle?: string;
  descriptionHtml?: string;
  media?: ProductMedia[];
  variants?: ProductVariant[];
  rating?: { avg?: number; count?: number } | number;
  brandId?: unknown;
  categoryIds?: unknown[];
};

type NamedRow = {
  _id: unknown;
  name?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function convertToIdr(amount: number, currency: string): number {
  if (String(currency || '').toUpperCase() === 'USD') {
    return Math.round(amount * 16000);
  }
  return amount;
}

function stripHtml(input: unknown): string {
  return String(input || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickPrice(variants: ProductVariant[] | undefined) {
  const first = Array.isArray(variants) ? variants[0] : null;
  const sourceCurrency = String(first?.price?.currency || 'IDR').toUpperCase();
  const list = convertToIdr(toNumber(first?.price?.list, 0), sourceCurrency);
  const saleRaw = first?.price?.sale;
  const saleConverted = saleRaw === null || saleRaw === undefined ? 0 : convertToIdr(toNumber(saleRaw, 0), sourceCurrency);
  const sale = saleRaw === null || saleRaw === undefined ? 0 : toNumber(saleRaw, 0);
  return {
    price: list,
    offerPrice: sale > 0 ? saleConverted : list,
    currency: 'IDR',
  };
}

export async function GET(request: Request) {
  await dbConnect();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const brand = searchParams.get('brand');
  const category = searchParams.get('category');
  const sort = searchParams.get('sort') || '-updatedAt';
  const page = Number(searchParams.get('page') || 1);
  const limit = Math.min(Number(searchParams.get('limit') || 12), 48);

  const filter: ProductListFilter = { status: 'active' };
  if (q) filter.$text = { $search: q };
  if (brand) filter.brandId = brand;
  if (category) filter.categoryIds = category;

  const cursor = Product.find(filter)
    .select('slug title subtitle descriptionHtml media variants.price rating brandId categoryIds updatedAt')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  const [items, total] = (await Promise.all([cursor.lean(), Product.countDocuments(filter)])) as unknown as [
    ProductRow[],
    number,
  ];

  const brandIds = [...new Set(items.map((item) => String(item.brandId || '')).filter(Boolean))];
  const categoryIds = [...new Set(items.flatMap((item) => item.categoryIds || []).map((id) => String(id)))];

  const [brands, categories] = (await Promise.all([
    brandIds.length
      ? Brand.find({ _id: { $in: brandIds } }).select('name').lean()
      : Promise.resolve([]),
    categoryIds.length
      ? Category.find({ _id: { $in: categoryIds } }).select('name').lean()
      : Promise.resolve([]),
  ])) as unknown as [NamedRow[], NamedRow[]];

  const brandMap = new Map(brands.map((brand) => [String(brand._id), brand.name || '']));
  const categoryMap = new Map(categories.map((cat) => [String(cat._id), cat.name || '']));

  const mapped = items.map((item) => {
    const images = (Array.isArray(item.media) ? item.media : [])
      .map((media) => String(media?.url || '').trim())
      .filter(Boolean);
    const categoryNames = (item.categoryIds || [])
      .map((id) => categoryMap.get(String(id)))
      .filter(Boolean) as string[];
    const brandName = brandMap.get(String(item.brandId || '')) || '';
    const summary = stripHtml(item.subtitle || item.descriptionHtml).slice(0, 180);
    const ratingAvg =
      typeof item.rating === 'number' ? toNumber(item.rating, 0) : toNumber(item.rating?.avg, 0);
    const ratingCount = typeof item.rating === 'number' ? 0 : toNumber(item.rating?.count, 0);
    const { price, offerPrice, currency } = pickPrice(item.variants);

    return {
      ...item,
      name: item.title || '',
      description: summary,
      image: images,
      price,
      offerPrice,
      currency,
      brand: brandName || 'Generic',
      category: categoryNames[0] || 'Lainnya',
      brandName,
      categoryNames,
      rating: ratingAvg,
      ratingCount,
      thumbnail: images[0] || null,
      variantsCount: Array.isArray(item.variants) ? item.variants.length : 0,
    };
  });

  return Response.json({ items: mapped, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(request: Request) {
  await dbConnect();
  const body = (await request.json()) as Record<string, unknown>;
  const prod = await Product.create(body);
  return Response.json(prod, { status: 201 });
}

