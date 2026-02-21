//app/db/utils/api.js
import axios from 'axios';

export const api = axios.create({
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// helper kecil untuk get data saja
export const ok = (p) => p.then(r => r.data);
