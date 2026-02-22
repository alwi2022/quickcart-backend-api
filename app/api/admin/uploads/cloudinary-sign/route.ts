export const runtime = 'nodejs';

import crypto from 'node:crypto';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const DEFAULT_FOLDER = process.env.CLOUDINARY_UPLOAD_FOLDER || 'galatech/products';

type SignRequestBody = {
  folder?: string;
  public_id?: string;
  eager?: string;
};

type SignParams = {
  folder: string;
  timestamp: number;
  public_id?: string;
  eager?: string;
};

function sign(params: SignParams, secret: string): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  entries.sort(([a], [b]) => a.localeCompare(b));
  const toSign = entries.map(([k, v]) => `${k}=${v}`).join('&') + secret;
  return crypto.createHash('sha1').update(toSign).digest('hex');
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      throw new BadRequestError('Cloudinary env missing');
    }

    const body = (await req.json().catch(() => ({}))) as SignRequestBody;

    const params: SignParams = {
      folder: body.folder || DEFAULT_FOLDER,
      timestamp: Math.floor(Date.now() / 1000),
    };
    if (body.public_id) params.public_id = body.public_id;
    if (body.eager) params.eager = body.eager;

    const signature = sign(params, API_SECRET);

    return json({
      cloudName: CLOUD_NAME,
      apiKey: API_KEY,
      ...params,
      signature,
    });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
