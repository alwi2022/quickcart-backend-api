type ProductVariant = {
  price?: {
    sale?: number | string | null;
    list?: number | string | null;
  };
};

export function getActiveUnitPrice(variant: ProductVariant): number {
  const sale = variant?.price?.sale;
  const list = variant?.price?.list ?? 0;
  return sale != null && sale !== '' ? Number(sale) : Number(list);
}
  
