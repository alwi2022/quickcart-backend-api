// app/api/admin/uploads/cloudinary-destroy/route.js
export const runtime = 'nodejs';

import crypto from 'node:crypto';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export async function POST(req) {
  try {
    requireAdmin();
    const { public_id } = await req.json();
    if (!public_id) throw new BadRequestError('public_id wajib');
    if (!CLOUD_NAME || !API_KEY || !API_SECRET) throw new BadRequestError('Cloudinary env missing');

    const timestamp = Math.floor(Date.now()/1000);
    const toSign = `public_id=${public_id}&timestamp=${timestamp}${API_SECRET}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    const fd = new URLSearchParams();
    fd.set('public_id', public_id);
    fd.set('timestamp', String(timestamp));
    fd.set('api_key', API_KEY);
    fd.set('signature', signature);

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`;
    const res = await fetch(url, { method: 'POST', body: fd });
    const j = await res.json();
    if (!res.ok || j.result !== 'ok') {
      return json({ error: j?.error?.message || 'Destroy gagal' }, { status: 400 });
    }
    return json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
