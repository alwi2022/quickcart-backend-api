// app/api/admin/stats/route.js
export const runtime = 'nodejs';

import { dbConnect } from '@/app/db/config/mongoose';
import { Order, Product, User, Inventory } from '@/app/db/models';
import { handleApiError, json } from '@/app/db/utils/errors';
import { requireAdmin } from '../_guard';

export async function GET() {
  try {
    // ✅ 1) Auth dulu (await!)
    await requireAdmin();

    // ✅ 2) Baru connect DB (hemat waktu kalau unauthorized)
    await dbConnect();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      ordersCount,
      ordersToday,
      gmvAgg,
      gmvTodayAgg,
      productsCount,
      usersCount,
      latestOrders,
      lowStockAgg,
    ] = await Promise.all([
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
        // ⚠️ pastikan field-nya memang `qty`. Kalau skemamu pakai `onHand`, ganti di sini.
        { $match: { qty: { $lte: 5 } } },
        { $project: { productId: 1, sku: 1, qty: 1 } },
        { $limit: 6 },
      ]),
    ]);

    // Enrich low stock dengan nama produk
    const productMap = new Map();
    if (lowStockAgg.length) {
      const ids = lowStockAgg.map((i) => i.productId).filter(Boolean);
      if (ids.length) {
        const ps = await Product.find({ _id: { $in: ids } }).select('name').lean();
        ps.forEach((p) => productMap.set(String(p._id), p.name));
      }
    }
    const lowStock = lowStockAgg.map((i) => ({
      _id: i._id,
      sku: i.sku,
      qty: i.qty,
      productName: productMap.get(String(i.productId)) || 'Unknown',
    }));

    return json({
      orders: { count: ordersCount, today: ordersToday },
      gmv: { total: gmvAgg?.[0]?.total ?? 0, today: gmvTodayAgg?.[0]?.total ?? 0 },
      products: productsCount,
      users: usersCount,
      latestOrders,
      lowStock,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
