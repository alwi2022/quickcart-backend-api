// app/api/admin/uploads/cloudinary-sign/route.js
export const runtime = 'nodejs';

import crypto from 'node:crypto';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const DEFAULT_FOLDER = process.env.CLOUDINARY_UPLOAD_FOLDER || 'galatech/products';

// susun string sign TANPA url-encode, sorted by key
function sign(params, secret) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '');
  entries.sort(([a], [b]) => a.localeCompare(b));
  const toSign = entries.map(([k, v]) => `${k}=${v}`).join('&') + secret;
  return crypto.createHash('sha1').update(toSign).digest('hex');
}

export async function POST(req) {
  try {
    await requireAdmin(); // ✅ wajib await

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      throw new BadRequestError('Cloudinary env missing');
    }

    const body = await req.json().catch(() => ({}));

    const timestamp = Math.floor(Date.now() / 1000);
    const folder     = body?.folder || DEFAULT_FOLDER; // pastikan ini sesuai yang akan dipakai saat upload
    const public_id  = body?.public_id;                // opsional
    const eager      = body?.eager;                    // opsional (mis. "w_600,h_600,c_fill|w_300,h_300,c_fill")

    const params = { folder, timestamp };
    if (public_id) params.public_id = public_id;
    if (eager)     params.eager     = eager;

    const signature = sign(params, API_SECRET);

    return json({
      cloudName: CLOUD_NAME,
      apiKey: API_KEY,
      ...params,   // folder, timestamp, (public_id), (eager)
      signature,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
