export const runtime = 'nodejs';

import crypto from 'node:crypto';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

type DestroyRequestBody = {
  public_id?: string;
};

type CloudinaryDestroyResponse = {
  result?: string;
  error?: {
    message?: string;
  };
};

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { public_id } = (await req.json()) as DestroyRequestBody;
    if (!public_id) throw new BadRequestError('public_id wajib');
    if (!CLOUD_NAME || !API_KEY || !API_SECRET) throw new BadRequestError('Cloudinary env missing');

    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${public_id}&timestamp=${timestamp}${API_SECRET}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    const formData = new URLSearchParams();
    formData.set('public_id', public_id);
    formData.set('timestamp', String(timestamp));
    formData.set('api_key', API_KEY);
    formData.set('signature', signature);

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`;
    const response = await fetch(url, { method: 'POST', body: formData });
    const payload = (await response.json()) as CloudinaryDestroyResponse;
    if (!response.ok || payload.result !== 'ok') {
      return json({ error: payload.error?.message || 'Destroy gagal' }, { status: 400 });
    }

    return json({ ok: true });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
