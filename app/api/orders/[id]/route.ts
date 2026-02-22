export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Order from '@/app/db/models/Order';
import Inventory from '@/app/db/models/Inventory';
import { handleApiError, json, BadRequestError, UnauthorizedError } from '@/app/db/utils/errors';
import { requireUser } from '../../_guard';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type OrderItemLite = {
  productId: unknown;
  variantId: unknown;
  sku?: string;
  qty: number;
};

type OrderLite = {
  _id: unknown;
  userId: unknown;
  status: string;
  items?: OrderItemLite[];
  save?: () => Promise<unknown>;
};

type OrderPatchBody = {
  action?: 'cancel';
};

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    const user = await requireUser();
    const { id } = await params;

    const doc = ((await Order.findById(id).lean()) as unknown) as OrderLite | null;
    if (!doc) throw new BadRequestError('Order tidak ditemukan');
    if (String(doc.userId) !== String(user.sub)) {
      throw new UnauthorizedError('Tidak boleh akses order orang lain');
    }

    return json({ item: doc });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as OrderPatchBody;

    const doc = ((await Order.findById(id)) as unknown) as OrderLite | null;
    if (!doc || !doc.save) throw new BadRequestError('Order tidak ditemukan');
    if (String(doc.userId) !== String(user.sub)) {
      throw new UnauthorizedError('Tidak boleh akses order orang lain');
    }

    if (body.action === 'cancel') {
      if (doc.status !== 'awaiting_payment') {
        throw new BadRequestError('Order tidak bisa dibatalkan');
      }
      doc.status = 'cancelled';
      await doc.save();

      if (Array.isArray(doc.items)) {
        await Promise.all(
          doc.items.map((item) =>
            Inventory.updateOne(
              {
                product_id: item.productId,
                variant_id: item.variantId,
                sku: item.sku,
                warehouse: 'main',
              },
              { $inc: { qty: item.qty } },
            ),
          ),
        );
      }

      return json({ item: { _id: doc._id, status: doc.status } });
    }

    return json({ error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

