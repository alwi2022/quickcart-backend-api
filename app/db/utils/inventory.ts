import Inventory from '@/app/db/models/Inventory';
import { BadRequestError } from './errors';

export type InventoryReservationItem = {
  productId: string;
  variantId: string;
  sku: string;
  qty: number;
};

type InventoryQtyDoc = {
  qty?: number;
};

export async function reserveInventoryOrThrow(items: InventoryReservationItem[]): Promise<void> {
  for (const item of items) {
    const stockDoc = ((await Inventory.findOne({
      product_id: item.productId,
      variant_id: item.variantId,
      sku: item.sku,
      warehouse: 'main',
    })) as unknown) as InventoryQtyDoc | null;

    const available = Number(stockDoc?.qty ?? 0);
    if (available < item.qty) {
      throw new BadRequestError(`Stok tidak cukup untuk SKU ${item.sku}`);
    }
  }

  await Promise.all(
    items.map((item) =>
      Inventory.updateOne(
        {
          product_id: item.productId,
          variant_id: item.variantId,
          sku: item.sku,
          warehouse: 'main',
        },
        { $inc: { qty: -item.qty } },
      ),
    ),
  );
}
