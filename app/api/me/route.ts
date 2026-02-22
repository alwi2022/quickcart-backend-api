export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { dbConnect } from '@/app/db/config/mongoose';
import User from '@/app/db/models/User';
import { verifyToken } from '@/app/db/utils/jwt';
import { handleApiError, json, UnauthorizedError } from '@/app/db/utils/errors';

type MeUser = {
  name?: string;
  email?: string;
  roles?: string[];
  status?: string;
};

export async function GET() {
  try {
    await dbConnect();

    const token = (await cookies()).get('gt_auth')?.value;
    if (!token) throw new UnauthorizedError('Missing token');

    const payload = verifyToken(token);
    const user = ((await User.findById(payload.sub).select('name email roles status').lean()) as unknown) as
      MeUser | null;
    if (!user || user.status !== 'active') throw new UnauthorizedError('User tidak aktif');

    return json({ user });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}
