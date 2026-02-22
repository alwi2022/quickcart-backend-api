export function makeOrderNo(date: Date = new Date()): string {
  const pad = (n: number, size = 6): string => String(n).padStart(size, '0');
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = pad(Math.floor(Math.random() * 1e6));
  return `AG-${y}${m}${d}-${rand}`;
}
