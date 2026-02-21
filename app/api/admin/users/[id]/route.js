export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { User } from '@/app/db/models';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';
import { hashPassword } from '@/app/db/utils/bcrypt';

export async function GET(_req, { params }) {
    try {
        await requireAdmin();
        await dbConnect();
        const item = await User.findById(params.id).select('-password_hash').lean();
        if (!item) throw new BadRequestError('User tidak ditemukan');
        return json({ item });
    } catch (e) {
        return handleApiError(e);
    }
}

export async function PATCH(request, { params }) {
    try {
        await requireAdmin();
        await dbConnect();
        const body = await request.json();

        const doc = await User.findById(params.id);
        if (!doc) throw new BadRequestError('User tidak ditemukan');

        if (body.name !== undefined) doc.name = body.name;
        if (body.email !== undefined) doc.email = body.email;
        if (body.phone !== undefined) doc.phone = body.phone;
        if (body.password !== undefined) doc.password_hash = await hashPassword(body.password);

        if (Array.isArray(body.roles)) doc.roles = body.roles;
        if (body.status) doc.status = body.status; // 'active' | 'blocked' | 'deleted'

        await doc.save();
        return json({ item: { _id: doc._id } });
    } catch (e) {
        // duplicate email guard
        if (e?.code === 11000 && e?.keyPattern?.email) {
            return json({ error: 'Email sudah terpakai' }, { status: 400 });
        }
        return handleApiError(e);
    }
}

export async function DELETE(_req, { params }) {
    try {
        await requireAdmin();
        await dbConnect();
        await User.findByIdAndDelete(params.id);
        return json({ ok: true });
    } catch (e) {
        return handleApiError(e);
    }
}
