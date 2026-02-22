export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Product from '@/app/db/models/Product';
import Category from '@/app/db/models/Category';
import Brand from '@/app/db/models/Brand';
import Inventory from '@/app/db/models/Inventory';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

type ProductFilter = {
  $or?: Array<{ title?: RegExp; slug?: RegExp; sku?: RegExp; 'variants.sku'?: RegExp }>;
};

type ProductListRow = {
  _id: unknown;
  brandId?: unknown;
  categoryIds?: unknown[];
  variants?: Array<{ price?: { sale?: number | string | null; list?: number | string | null } }>;
  media?: Array<{ url?: string }>;
} & Record<string, unknown>;

type NamedRow = {
  _id: unknown;
  name?: string;
};

type ProductMediaInput = {
  url: string;
  alt?: string;
};

type ProductVariantInput = {
  sku: string;
  options?: Record<string, unknown>;
  price?: {
    currency?: string;
    list?: number | string;
    sale?: number | string | null;
    startAt?: string;
    endAt?: string;
  };
  weightGram?: number | string | null;
  dimensionsCm?: Record<string, unknown>;
  barcode?: string;
  status?: string;
};

type ProductInventoryInput = {
  sku?: string;
  qty?: number | string;
  warehouse?: string;
};

type ProductCreateBody = {
  slug?: string;
  sku?: string;
  title?: string;
  subtitle?: string;
  brandId?: string;
  categoryIds?: string[];
  descriptionHtml?: string;
  media?: ProductMediaInput[];
  attributes?: Record<string, unknown>;
  variants?: ProductVariantInput[];
  seo?: { title?: string; metaDescription?: string };
  status?: string;
  inventory?: ProductInventoryInput[];
};

type CreatedProduct = {
  _id: unknown;
  variants: Array<{ sku: string; _id: unknown }>;
};

type DuplicateKeyError = {
  code: number;
  keyValue?: unknown;
};

function isDuplicateKeyError(error: unknown): error is DuplicateKeyError {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000;
}

export async function GET(request: Request) {
  try {
    await dbConnect();
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));
    const skip = (page - 1) * limit;

    const filter: ProductFilter = q
      ? {
          $or: [
            { title: new RegExp(q, 'i') },
            { slug: new RegExp(q, 'i') },
            { sku: new RegExp(q, 'i') },
            { 'variants.sku': new RegExp(q, 'i') },
          ],
        }
      : {};

    const [items, total] = ((await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title slug media brandId categoryIds status variants createdAt')
        .lean(),
      Product.countDocuments(filter),
    ])) as unknown) as [ProductListRow[], number];

    const brandIds = [...new Set(items.map((item) => String(item.brandId)).filter(Boolean))];
    const catIds = [...new Set(items.flatMap((item) => item.categoryIds || []).map(String))];

    const [brands, categories] = await Promise.all([
      brandIds.length
        ? (((await Brand.find({ _id: { $in: brandIds } }).select('name').lean()) as unknown) as NamedRow[])
        : [],
      catIds.length
        ? (((await Category.find({ _id: { $in: catIds } }).select('name').lean()) as unknown) as NamedRow[])
        : [],
    ]);

    const brandMap = new Map(brands.map((brand) => [String(brand._id), brand.name]));
    const categoryMap = new Map(categories.map((cat) => [String(cat._id), cat.name]));

    const mapped = items.map((product) => ({
      ...product,
      brandName: product.brandId ? brandMap.get(String(product.brandId)) : null,
      categoryNames: (product.categoryIds || []).map((id) => categoryMap.get(String(id))).filter(Boolean),
      price: product.variants?.[0]?.price?.sale ?? product.variants?.[0]?.price?.list ?? null,
      thumbnail: product.media?.[0]?.url || null,
      variantsCount: product.variants?.length || 0,
    }));

    return json({ items: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    await requireAdmin();

    const body = (await request.json()) as ProductCreateBody;

    if (!body.title) throw new BadRequestError('title wajib');
    if (!Array.isArray(body.categoryIds) || body.categoryIds.length === 0) {
      throw new BadRequestError('categoryIds minimal 1');
    }
    if (!body.brandId) throw new BadRequestError('brandId wajib');
    if (!Array.isArray(body.variants) || body.variants.length === 0) {
      throw new BadRequestError('variants minimal 1');
    }

    for (const variant of body.variants) {
      if (!variant?.sku) throw new BadRequestError('variant.sku wajib');
      if (variant?.price?.list === undefined || variant?.price?.list === null) {
        throw new BadRequestError('variant.price.list wajib');
      }
    }

    const skuSeen = new Set<string>();
    for (const variant of body.variants) {
      const sku = variant.sku.trim();
      if (skuSeen.has(sku)) throw new BadRequestError(`SKU duplikat di payload: ${sku}`);
      skuSeen.add(sku);
    }

    const payload = {
      slug: body.slug?.trim() || null,
      sku: body.sku?.trim() || null,
      title: body.title,
      subtitle: body.subtitle || null,
      brandId: body.brandId,
      categoryIds: body.categoryIds,
      descriptionHtml: body.descriptionHtml || null,
      media: Array.isArray(body.media) ? body.media.map((m) => ({ url: m.url, alt: m.alt || '' })) : [],
      attributes: body.attributes || {},
      variants: body.variants.map((variant) => ({
        sku: variant.sku,
        options: variant.options || {},
        price: {
          currency: variant.price?.currency || 'IDR',
          list: Number(variant.price?.list) || 0,
          sale: variant.price?.sale == null ? null : Number(variant.price.sale),
          startAt: variant.price?.startAt ? new Date(variant.price.startAt) : undefined,
          endAt: variant.price?.endAt ? new Date(variant.price.endAt) : undefined,
        },
        weightGram: variant.weightGram == null ? undefined : Number(variant.weightGram),
        dimensionsCm: variant.dimensionsCm || undefined,
        barcode: variant.barcode || undefined,
        status: variant.status || 'active',
      })),
      seo: {
        title: body.seo?.title || '',
        metaDescription: body.seo?.metaDescription || '',
      },
      status: body.status || 'active',
    };

    const doc = (await Product.create(payload) as unknown) as CreatedProduct;

    if (Array.isArray(body.inventory) && body.inventory.length) {
      const skuToVariantId = new Map(doc.variants.map((variant) => [variant.sku, variant._id]));
      const inventoryDocs = body.inventory
        .filter((item) => item?.sku)
        .map((item) => ({
          product_id: doc._id,
          variant_id: item.sku ? skuToVariantId.get(item.sku) : undefined,
          sku: item.sku,
          qty: Number(item.qty) || 0,
          warehouse: item.warehouse || 'main',
        }));

      await Inventory.insertMany(inventoryDocs);
    }

    return json({ item: { _id: doc._id } }, { status: 201 });
  } catch (e: unknown) {
    if (isDuplicateKeyError(e)) {
      return json({ error: 'Duplicate key', detail: e.keyValue }, { status: 400 });
    }
    return handleApiError(e);
  }
}

