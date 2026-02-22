export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import Order from '@/app/db/models/Order';
import Product from '@/app/db/models/Product';
import User from '@/app/db/models/User';
import Inventory from '@/app/db/models/Inventory';
import { handleApiError, json } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

type TotalAgg = {
  _id: null;
  total: number;
};

type LowStockAgg = {
  _id: unknown;
  productId?: unknown;
  sku?: string;
  qty?: number;
};

type ProductNameRow = {
  _id: unknown;
  name?: string;
};

export async function GET() {
  try {
    await requireAdmin();
    await dbConnect();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [ordersCount, ordersToday, gmvAgg, gmvTodayAgg, productsCount, usersCount, latestOrders, lowStockAgg] =
      (await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: todayStart } }),
        Order.aggregate([{ $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } }]),
        Order.aggregate([
          { $match: { createdAt: { $gte: todayStart } } },
          { $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } },
        ]),
        Product.countDocuments(),
        User.countDocuments(),
        Order.find({})
          .sort({ createdAt: -1 })
          .limit(6)
          .select('orderNo status pricing.grandTotal createdAt')
          .lean(),
        Inventory.aggregate([
          { $match: { qty: { $lte: 5 } } },
          { $project: { productId: 1, sku: 1, qty: 1 } },
          { $limit: 6 },
        ]),
      ])) as [number, number, TotalAgg[], TotalAgg[], number, number, unknown[], LowStockAgg[]];

    const productMap = new Map<string, string>();
    if (lowStockAgg.length) {
      const ids = lowStockAgg.map((item) => item.productId).filter(Boolean);
      if (ids.length) {
        const products = ((await Product.find({ _id: { $in: ids } }).select('name').lean()) as unknown) as
          ProductNameRow[];
        products.forEach((product) => {
          productMap.set(String(product._id), product.name || 'Unknown');
        });
      }
    }

    const lowStock = lowStockAgg.map((item) => ({
      _id: item._id,
      sku: item.sku,
      qty: item.qty,
      productName: productMap.get(String(item.productId)) || 'Unknown',
    }));

    return json({
      orders: { count: ordersCount, today: ordersToday },
      gmv: { total: gmvAgg[0]?.total ?? 0, today: gmvTodayAgg[0]?.total ?? 0 },
      products: productsCount,
      users: usersCount,
      latestOrders,
      lowStock,
    });
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

