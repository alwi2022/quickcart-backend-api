// app/db/utils/pricing.js
export function getActiveUnitPrice(variant) {
    const sale = variant?.price?.sale;
    const list = variant?.price?.list ?? 0;
    return (sale != null && sale !== '') ? Number(sale) : Number(list);
  }
  