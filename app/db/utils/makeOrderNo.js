// utils/makeOrderNo.js
export function makeOrderNo(date = new Date()) {
    const pad = (n, s = 6) => String(n).padStart(s, "0");
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const rand = pad(Math.floor(Math.random() * 1e6));
    return `AG-${y}${m}${d}-${rand}`;
}