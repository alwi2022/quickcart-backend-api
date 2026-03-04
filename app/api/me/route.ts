export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import User from '@/app/db/models/User';
import { verifyPassword, hashPassword } from '@/app/db/utils/bcrypt';
import {
  BadRequestError,
  handleApiError,
  json,
  UnauthorizedError,
} from '@/app/db/utils/errors';
import { requireUser } from '../_guard';

type MeUser = {
  _id: unknown;
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  birthday?: string;
  roles?: string[];
  status?: string;
  addresses?: AddressDoc[];
  default_address_id?: unknown;
};

type AddressDoc = {
  _id?: unknown;
  label?: string;
  receiver_name?: string;
  phone?: string;
  street?: string;
  subdistrict?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  is_default?: boolean;
  geo?: { lat?: number; lng?: number };
};

type MePatchBody = {
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  birthday?: string;
  currentPassword?: string;
  newPassword?: string;
  address?: {
    id?: string;
    label?: string;
    receiverName?: string;
    phone?: string;
    street?: string;
    subdistrict?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    isDefault?: boolean;
    lat?: number | null;
    lng?: number | null;
  };
};

type UserDoc = {
  _id: unknown;
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  birthday?: string;
  roles?: string[];
  status?: string;
  password_hash?: string;
  addresses?: AddressDoc[];
  default_address_id?: unknown;
  save: () => Promise<unknown>;
};

type DuplicateKeyError = {
  code: number;
  keyPattern?: Record<string, unknown>;
};

function sanitize(value: unknown): string {
  return String(value || '').trim();
}

function pickUserPayload(user: MeUser | UserDoc) {
  return {
    _id: user._id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    gender: user.gender || '',
    birthday: user.birthday || '',
    roles: Array.isArray(user.roles) ? user.roles : [],
    status: user.status || 'active',
    default_address_id: user.default_address_id || null,
    addresses: Array.isArray(user.addresses)
      ? user.addresses.map((addr) => ({
          _id: addr?._id,
          label: addr?.label || '',
          receiver_name: addr?.receiver_name || '',
          phone: addr?.phone || '',
          street: addr?.street || '',
          subdistrict: addr?.subdistrict || '',
          city: addr?.city || '',
          province: addr?.province || '',
          postal_code: addr?.postal_code || '',
          country: addr?.country || 'ID',
          is_default: Boolean(addr?.is_default),
          geo: {
            lat: Number(addr?.geo?.lat || 0) || undefined,
            lng: Number(addr?.geo?.lng || 0) || undefined,
          },
        }))
      : [],
  };
}

function isDuplicateKey(e: unknown): e is DuplicateKeyError {
  return typeof e === 'object' && e !== null && (e as DuplicateKeyError).code === 11000;
}

function validateAddressInput(address: NonNullable<MePatchBody['address']>) {
  const receiverName = sanitize(address.receiverName);
  const phone = sanitize(address.phone);
  const street = sanitize(address.street);
  const subdistrict = sanitize(address.subdistrict);
  const city = sanitize(address.city);
  const province = sanitize(address.province);
  const postalCode = sanitize(address.postalCode);

  if (!receiverName || !phone || !street || !subdistrict || !city || !province || !postalCode) {
    throw new BadRequestError('Data alamat belum lengkap');
  }
}

export async function GET() {
  try {
    await dbConnect();
    const auth = await requireUser();

    const user = ((await User.findById(auth.sub)
      .select('name email phone gender birthday roles status addresses default_address_id')
      .lean()) as unknown) as MeUser | null;

    if (!user || user.status !== 'active') {
      throw new UnauthorizedError('User tidak aktif');
    }

    return json({ user: pickUserPayload(user) });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const auth = await requireUser();
    const body = (await request.json()) as MePatchBody;

    const user = ((await User.findById(auth.sub)) as unknown) as UserDoc | null;
    if (!user || user.status !== 'active' || !user.save) {
      throw new UnauthorizedError('User tidak aktif');
    }

    if (body.newPassword !== undefined) {
      const currentPassword = sanitize(body.currentPassword);
      const newPassword = sanitize(body.newPassword);

      if (!currentPassword || !newPassword) {
        throw new BadRequestError('currentPassword dan newPassword wajib diisi');
      }
      if (newPassword.length < 8) {
        throw new BadRequestError('Password baru minimal 8 karakter');
      }

      const ok = await verifyPassword(currentPassword, user.password_hash || '');
      if (!ok) throw new BadRequestError('Password saat ini salah');

      user.password_hash = await hashPassword(newPassword);
    }

    if (body.address) {
      validateAddressInput(body.address);

      const nextAddress: AddressDoc = {
        label: sanitize(body.address.label) || 'Rumah',
        receiver_name: sanitize(body.address.receiverName),
        phone: sanitize(body.address.phone),
        street: sanitize(body.address.street),
        subdistrict: sanitize(body.address.subdistrict),
        city: sanitize(body.address.city),
        province: sanitize(body.address.province),
        postal_code: sanitize(body.address.postalCode),
        country: sanitize(body.address.country) || 'ID',
        is_default: Boolean(body.address.isDefault),
        geo: {
          lat: Number(body.address.lat ?? 0) || undefined,
          lng: Number(body.address.lng ?? 0) || undefined,
        },
      };

      const addresses = Array.isArray(user.addresses) ? user.addresses : [];
      const incomingId = sanitize(body.address.id);
      let targetId: unknown = null;

      if (incomingId) {
        const idx = addresses.findIndex((addr) => String(addr?._id || '') === incomingId);
        if (idx >= 0) {
          addresses[idx] = { ...addresses[idx], ...nextAddress };
          targetId = addresses[idx]._id;
        } else {
          addresses.push(nextAddress);
          targetId = addresses[addresses.length - 1]?._id;
        }
      } else {
        addresses.push(nextAddress);
        targetId = addresses[addresses.length - 1]?._id;
      }

      if (nextAddress.is_default || !user.default_address_id) {
        user.default_address_id = targetId;
        user.addresses = addresses.map((addr) => ({
          ...addr,
          is_default: String(addr?._id || '') === String(targetId || ''),
        }));
      } else {
        user.addresses = addresses;
      }
    }

    if (body.address === undefined) {
      if (body.name !== undefined) user.name = sanitize(body.name);
      if (body.email !== undefined) user.email = sanitize(body.email).toLowerCase();
      if (body.phone !== undefined) user.phone = sanitize(body.phone);
      if (body.gender !== undefined) user.gender = sanitize(body.gender);
      if (body.birthday !== undefined) user.birthday = sanitize(body.birthday);
    }

    await user.save();

    return json({ user: pickUserPayload(user) });
  } catch (e: unknown) {
    if (isDuplicateKey(e)) {
      const key = Object.keys(e.keyPattern || {})[0] || 'field';
      return json({ error: `${key} sudah digunakan` }, { status: 400 });
    }
    return handleApiError(e);
  }
}
