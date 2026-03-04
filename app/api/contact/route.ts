export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Event from '@/app/db/models/Event';
import { BadRequestError, handleApiError, json } from '@/app/db/utils/errors';

type ContactBody = {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
};

function sanitize(value: unknown): string {
  return String(value || '').trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = (await request.json().catch(() => ({}))) as ContactBody;

    const name = sanitize(body.name);
    const email = sanitize(body.email).toLowerCase();
    const phone = sanitize(body.phone);
    const subject = sanitize(body.subject);
    const message = sanitize(body.message);

    if (!name || !email || !message) {
      throw new BadRequestError('name, email, dan message wajib diisi');
    }
    if (!isValidEmail(email)) {
      throw new BadRequestError('Format email tidak valid');
    }

    await Event.create({
      type: 'contact',
      meta: {
        name,
        email,
        phone,
        subject,
        message,
      },
    });

    return json({ ok: true });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

