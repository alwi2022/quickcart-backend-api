import axios from 'axios';
import type { AxiosResponse } from 'axios';

export const api = axios.create({
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const ok = <T>(p: Promise<AxiosResponse<T>>): Promise<T> => p.then((r) => r.data);
