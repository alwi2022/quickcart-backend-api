// app/api/admin/products/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Product, Category, Brand, Inventory } from '@/app/db/models';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

export async function GET(request) {
  try {
    await dbConnect();
    requireAdmin();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));
    const skip = (page - 1) * limit;

    const filter = q
      ? {
          $or: [
            { title: new RegExp(q, 'i') },
            { slug: new RegExp(q, 'i') },
            { sku: new RegExp(q, 'i') },
            { 'variants.sku': new RegExp(q, 'i') },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title slug media brandId categoryIds status variants createdAt')
        .lean(),
      Product.countDocuments(filter),
    ]);

    // optional enrich brand/category names (ringan)
    const brandIds = [...new Set(items.map(i => String(i.brandId)).filter(Boolean))];
    const catIds = [...new Set(items.flatMap(i => i.categoryIds || []).map(String))];

    const [brands, categories] = await Promise.all([
      brandIds.length ? Brand.find({ _id: { $in: brandIds } }).select('name').lean() : [],
      catIds.length ? Category.find({ _id: { $in: catIds } }).select('name').lean() : [],
    ]);

    const bmap = new Map(brands.map(b => [String(b._id), b.name]));
    const cmap = new Map(categories.map(c => [String(c._id), c.name]));

    const mapped = items.map(p => ({
      ...p,
      brandName: p.brandId ? bmap.get(String(p.brandId)) : null,
      categoryNames: (p.categoryIds || []).map(id => cmap.get(String(id))).filter(Boolean),
      price: p.variants?.[0]?.price?.sale ?? p.variants?.[0]?.price?.list ?? null, // untuk tabel ringkas
      thumbnail: p.media?.[0]?.url || null,
      variantsCount: p.variants?.length || 0,
    }));

    return json({ items: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    requireAdmin();

    const body = await request.json();

    // Validasi minimum sesuai schema baru
    if (!body?.title) throw new BadRequestError('title wajib');
    if (!Array.isArray(body?.categoryIds) || body.categoryIds.length === 0)
      throw new BadRequestError('categoryIds minimal 1');
    if (!body?.brandId) throw new BadRequestError('brandId wajib');
    if (!Array.isArray(body?.variants) || body.variants.length === 0)
      throw new BadRequestError('variants minimal 1');
    for (const v of body.variants) {
      if (!v?.sku) throw new BadRequestError('variant.sku wajib');
      if (!v?.price?.list && v?.price?.list !== 0) throw new BadRequestError('variant.price.list wajib');
    }

    // Optional: deteksi duplikat SKU varian dalam payload
    const dupe = new Set();
    for (const v of body.variants) {
      const s = v.sku.trim();
      if (dupe.has(s)) throw new BadRequestError(`SKU duplikat di payload: ${s}`);
      dupe.add(s);
    }

    const payload = {
      slug: body.slug?.trim() || null,
      sku: body.sku?.trim() || null,
      title: body.title,
      subtitle: body.subtitle || null,
      brandId: body.brandId,
      categoryIds: body.categoryIds,
      descriptionHtml: body.descriptionHtml || null,
      media: Array.isArray(body.media) ? body.media.map(m => ({ url: m.url, alt: m.alt || '' })) : [],
      attributes: body.attributes || {},
      variants: body.variants.map(v => ({
        sku: v.sku,
        options: v.options || {}, // { color, size, ... }
        price: {
          currency: v.price?.currency || 'IDR',
          list: Number(v.price?.list) || 0,
          sale: v.price?.sale == null ? null : Number(v.price?.sale),
          startAt: v.price?.startAt ? new Date(v.price.startAt) : undefined,
          endAt: v.price?.endAt ? new Date(v.price.endAt) : undefined,
        },
        weightGram: v.weightGram == null ? undefined : Number(v.weightGram),
        dimensionsCm: v.dimensionsCm || undefined,
        barcode: v.barcode || undefined,
        status: v.status || 'active',
      })),
      seo: { title: body.seo?.title || '', metaDescription: body.seo?.metaDescription || '' },
      status: body.status || 'active',
    };

    const doc = await Product.create(payload);

    // Optional: initial inventory mapping by sku
    if (Array.isArray(body.inventory) && body.inventory.length) {
      const sk2id = new Map(doc.variants.map(v => [v.sku, v._id]));
      await Inventory.insertMany(
        body.inventory
          .filter(iv => iv?.sku)
          .map(iv => ({
            product_id: doc._id,
            variant_id: sk2id.get(iv.sku),
            sku: iv.sku,
            qty: Number(iv.qty) || 0,
            warehouse: iv.warehouse || 'main',
          }))
      );
    }

    return json({ item: { _id: doc._id } }, { status: 201 });
  } catch (e) {
    // tangani error unique index (slug/variant.sku)
    if (e?.code === 11000) {
      return json({ error: 'Duplicate key', detail: e?.keyValue }, { status: 400 });
    }
    return handleApiError(e);
  }
}
