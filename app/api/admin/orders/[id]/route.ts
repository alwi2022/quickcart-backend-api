export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Order from '@/app/db/models/Order';
import { handleApiError, json, BadRequestError } from '@/app/db/utils/errors';
import { requireAdmin } from '../../_guard';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type OrderStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'refunded';

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

type ShipmentInfo = {
  courier?: string;
  service?: string;
  trackingNo?: string;
  toObject?: () => Record<string, unknown>;
};

type PaymentInfo = {
  status?: PaymentStatus;
  toObject?: () => Record<string, unknown>;
};

type OrderMutable = {
  _id: unknown;
  status: OrderStatus;
  shipment?: ShipmentInfo;
  payment?: PaymentInfo;
  save: () => Promise<unknown>;
};

type OrderPatchBody = {
  status?: OrderStatus;
  shipment?: ShipmentInfo;
  paymentStatus?: PaymentStatus;
};

const allowedStatus: OrderStatus[] = [
  'awaiting_payment',
  'paid',
  'processing',
  'shipped',
  'completed',
  'cancelled',
  'refunded',
];

const allowedPaymentStatus: PaymentStatus[] = ['pending', 'paid', 'failed', 'expired'];

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();
    const { id } = await params;

    const doc = await Order.findById(id).lean();
    if (!doc) throw new BadRequestError('Order tidak ditemukan');
    return json({ item: doc });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await dbConnect();
    await requireAdmin();
    const { id } = await params;

    const body = (await request.json()) as OrderPatchBody;
    const doc = ((await Order.findById(id)) as unknown) as OrderMutable | null;
    if (!doc) throw new BadRequestError('Order tidak ditemukan');

    if (body.status) {
      if (!allowedStatus.includes(body.status)) throw new BadRequestError('Status tidak valid');
      doc.status = body.status;
    }

    if (body.shipment) {
      doc.shipment = {
        ...(doc.shipment?.toObject?.() ?? {}),
        courier: body.shipment.courier ?? doc.shipment?.courier,
        service: body.shipment.service ?? doc.shipment?.service,
        trackingNo: body.shipment.trackingNo ?? doc.shipment?.trackingNo,
      };
    }

    if (body.paymentStatus) {
      if (!allowedPaymentStatus.includes(body.paymentStatus)) {
        throw new BadRequestError('Payment status tidak valid');
      }
      doc.payment = { ...(doc.payment?.toObject?.() ?? {}), status: body.paymentStatus };
    }

    await doc.save();
    return json({ item: { _id: doc._id, status: doc.status, payment: doc.payment, shipment: doc.shipment } });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

