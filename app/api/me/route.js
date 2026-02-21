//app/api/me/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { User } from '@/app/db/models';
import { verifyToken } from '@/app/db/utils/jwt';
import { handleApiError, json, UnauthorizedError } from '@/app/db/utils/errors';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    await dbConnect();

    // ✅ baca cookie via Next.js API
    const token = (await cookies()).get('gt_auth')?.value

    if (!token) throw new UnauthorizedError('Missing token');

    const payload = verifyToken(token); // akan throw jika invalid/expired
    const user = await User.findById(payload.sub).select('name email roles status').lean();
    if (!user || user.status !== 'active') throw new UnauthorizedError('User tidak aktif');

    return json({ user });
  } catch (e) {
    return handleApiError(e);
  }
}
