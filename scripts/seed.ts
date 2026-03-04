import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbConnect } from '../app/db/config/mongoose';
import UserModel from '../app/db/models/User';
import BrandModel from '../app/db/models/Brand';
import CategoryModel from '../app/db/models/Category';
import ProductModel from '../app/db/models/Product';
import { hashPassword } from '../app/db/utils/bcrypt';

type SeedUser = {
  name: string;
  email: string;
  password: string;
  roles: string[];
};

type LegacyProduct = {
  _id?: string;
  name?: string;
  description?: string;
  price?: number;
  offerPrice?: number;
  image?: string[];
  category?: string;
  brand?: string;
  date?: number;
};

type RefDoc = {
  _id: unknown;
  name?: string;
  slug?: string;
  image?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRODUCTS_DUMMY_PATH = path.resolve(__dirname, '../../quickcart-fe-ecommerce/assets/assets.tsx');
const IDR_RATE_PER_USD = 16000;

function toSlug(value = ''): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function usdToIdr(value: number): number {
  return Math.round(value * IDR_RATE_PER_USD);
}

function take<T>(arr: T[], max: number): T[] {
  return Array.isArray(arr) ? arr.slice(0, max) : [];
}

async function loadLegacyProducts(): Promise<LegacyProduct[]> {
  const source = await fs.readFile(PRODUCTS_DUMMY_PATH, 'utf8');
  const startMarker = 'export const productsDummyData =';
  const endMarker = 'export const userDummyData =';

  const startIdx = source.indexOf(startMarker);
  if (startIdx < 0) throw new Error('productsDummyData marker tidak ditemukan');

  const arrayStart = source.indexOf('[', startIdx);
  if (arrayStart < 0) throw new Error('productsDummyData array start tidak ditemukan');

  const endIdx = source.indexOf(endMarker, arrayStart);
  if (endIdx < 0) throw new Error('productsDummyData array end tidak ditemukan');

  const jsonRaw = source.slice(arrayStart, endIdx).trim();
  const parsed = JSON.parse(jsonRaw) as LegacyProduct[];
  return Array.isArray(parsed) ? parsed : [];
}

async function seedUsers(): Promise<void> {
  const users: SeedUser[] = [
    { name: 'Admin User', email: 'admin@example.com', password: 'password123', roles: ['admin'] },
    { name: 'Seller User', email: 'seller@example.com', password: 'password123', roles: ['seller'] },
    { name: 'Customer User', email: 'customer@example.com', password: 'password123', roles: ['customer'] },
  ];

  for (const user of users) {
    const exists = await UserModel.findOne({ email: user.email });
    if (exists) {
      console.log(`Skip user: ${user.email} already exists`);
      continue;
    }

    const password_hash = await hashPassword(user.password);
    await UserModel.create({
      name: user.name,
      email: user.email,
      password_hash,
      roles: user.roles,
      status: 'active',
    });
    console.log(`Inserted user: ${user.email} [${user.roles.join(', ')}]`);
  }
}

async function upsertBrand(name: string): Promise<RefDoc> {
  const normalized = String(name || '').trim() || 'Generic';
  const slug = toSlug(normalized) || 'generic';
  const doc = (await BrandModel.findOneAndUpdate(
    { slug },
    {
      $setOnInsert: {
        name: normalized,
        slug,
        status: 'active',
        country: '',
      },
    },
    { upsert: true, new: true },
  ).lean()) as unknown as RefDoc | null;
  if (!doc?._id) throw new Error(`Gagal upsert brand: ${normalized}`);
  return doc;
}

async function upsertCategory(name: string, image: string): Promise<RefDoc> {
  const normalized = String(name || '').trim() || 'Lainnya';
  const slug = toSlug(normalized) || 'lainnya';
  const doc = (await CategoryModel.findOneAndUpdate(
    { slug },
    {
      $setOnInsert: {
        name: normalized,
        slug,
        image: image || 'https://raw.githubusercontent.com/avinashdm/gs-images/main/quickcart/m16coelz8ivkk9f0nwrz.webp',
        parent_id: null,
        ancestors: [],
        order: 0,
      },
    },
    { upsert: true, new: true },
  ).lean()) as unknown as RefDoc | null;
  if (!doc?._id) throw new Error(`Gagal upsert category: ${normalized}`);
  return doc;
}

async function seedLegacyProducts(): Promise<void> {
  const products = await loadLegacyProducts();
  if (!products.length) {
    console.log('No legacy products found.');
    return;
  }

  const brandMap = new Map<string, RefDoc>();
  const categoryMap = new Map<string, RefDoc>();

  const categoryCover = new Map<string, string>();
  for (const item of products) {
    const cat = String(item.category || '').trim() || 'Lainnya';
    const firstImage = Array.isArray(item.image) && item.image.length ? String(item.image[0] || '').trim() : '';
    if (!categoryCover.has(cat) && firstImage) categoryCover.set(cat, firstImage);
  }

  const brandNames = [...new Set(products.map((item) => String(item.brand || '').trim() || 'Generic'))];
  for (const brandName of brandNames) {
    const doc = await upsertBrand(brandName);
    brandMap.set(brandName, doc);
  }

  const categoryNames = [...new Set(products.map((item) => String(item.category || '').trim() || 'Lainnya'))];
  for (const categoryName of categoryNames) {
    const cover = categoryCover.get(categoryName) || '';
    const doc = await upsertCategory(categoryName, cover);
    categoryMap.set(categoryName, doc);
  }

  let inserted = 0;
  let updated = 0;

  for (const item of products) {
    const title = String(item.name || '').trim();
    if (!title) continue;

    const sourceId = String(item._id || '').trim();
    const suffix = sourceId ? sourceId.slice(-6) : Math.random().toString(36).slice(2, 8);
    const slug = `seed-${toSlug(title)}-${suffix}`.slice(0, 140);

    const brandName = String(item.brand || '').trim() || 'Generic';
    const categoryName = String(item.category || '').trim() || 'Lainnya';

    const brand = brandMap.get(brandName);
    const category = categoryMap.get(categoryName);
    if (!brand?._id || !category?._id) continue;

    const imageUrls = take(
      (Array.isArray(item.image) ? item.image : []).map((url) => String(url || '').trim()).filter(Boolean),
      8,
    );
    const skuBase = `SEED-${(sourceId || suffix).slice(-8).toUpperCase()}`;
    const listPriceUsd = toNumber(item.price, 0);
    const offerPriceUsd = toNumber(item.offerPrice, listPriceUsd);
    const listPrice = usdToIdr(listPriceUsd);
    const offerPrice = usdToIdr(offerPriceUsd > 0 ? offerPriceUsd : listPriceUsd);

    const payload = {
      slug,
      sku: skuBase,
      title,
      subtitle: brandName,
      brandId: brand._id,
      categoryIds: [category._id],
      descriptionHtml: String(item.description || '').trim(),
      media: imageUrls.map((url, idx) => ({ url, alt: idx === 0 ? title : `${title} image ${idx + 1}` })),
      attributes: {
        legacySource: 'productsDummyData',
        legacyId: sourceId || null,
      },
      variants: [
        {
          sku: `${skuBase}-V1`,
          options: { variant: 'Default' },
          price: {
            currency: 'IDR',
            list: listPrice,
            sale: offerPrice > 0 ? offerPrice : null,
          },
          status: 'active',
        },
      ],
      seo: {
        title,
        metaDescription: String(item.description || '').slice(0, 160),
      },
      status: 'active',
    };

    const exists = await ProductModel.findOne({ slug }).select('_id').lean();
    if (!exists) {
      await ProductModel.create(payload);
      inserted += 1;
      continue;
    }

    await ProductModel.updateOne({ _id: exists._id }, { $set: payload });
    updated += 1;
  }

  console.log(`Seed products done. Inserted: ${inserted}, Updated: ${updated}, Total source: ${products.length}`);
}

async function seed(): Promise<void> {
  await dbConnect();
  await seedUsers();
  await seedLegacyProducts();
}

void seed()
  .then(() => mongoose.disconnect())
  .catch((err: unknown) => {
    console.error('Seed error:', err);
    mongoose.disconnect();
    process.exit(1);
  });
