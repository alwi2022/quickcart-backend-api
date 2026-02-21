// app/db/utils/inventory.js
import { Inventory } from '@/app/db/models';
import { BadRequestError } from './errors';

export async function reserveInventoryOrThrow(items) {
  // items: [{ productId, variantId, sku, qty }]
  for (const it of items) {
    const q = await Inventory.findOne({
      product_id: it.productId,
      variant_id: it.variantId,
      sku: it.sku,
      warehouse: 'main',
    });

    const available = q?.qty ?? 0;
    if (available < it.qty) {
      throw new BadRequestError(`Stok tidak cukup untuk SKU ${it.sku}`);
    }
  }
  // reduce
  await Promise.all(items.map(it => Inventory.updateOne(
    { product_id: it.productId, variant_id: it.variantId, sku: it.sku, warehouse: 'main' },
    { $inc: { qty: -it.qty } }
  )));
}
