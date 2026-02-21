// utils/validators.js
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().toLowerCase(),
  password: z.string().min(6),
});

export const reviewCreateSchema = z.object({
  productId: z.string().min(1),
  userId: z.string().min(1),
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  content: z.string().optional(),
  status: z.enum(['pending', 'published', 'rejected']).optional(),
});


export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1),
    sku: z.string().min(1),
    qty: z.number().int().positive(),
  })).min(1),
  shippingAddress: z.object({
    receiverName: z.string().min(1),
    phone: z.string().min(6),
    street: z.string().min(3),
    subdistrict: z.string().min(1),
    city: z.string().min(1),
    province: z.string().min(1),
    postalCode: z.string().min(3),
    country: z.string().default('ID'),
  }),
  billingAddress: z.any().optional(), // kalau beda alamat, kirim object yang sama strukturnya
  shippingCost: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  note: z.string().max(500).optional(),
  paymentMethod: z.string().default('manual'), // ex: 'manual' | 'gateway_x'
  channel: z.string().default('web'),
});