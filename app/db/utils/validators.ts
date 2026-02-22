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

const addressSchema = z.object({
  receiverName: z.string().min(1),
  phone: z.string().min(6),
  street: z.string().min(3),
  subdistrict: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  postalCode: z.string().min(3),
  country: z.string().default('ID'),
});

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        sku: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  shippingCost: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  note: z.string().max(500).optional(),
  paymentMethod: z.string().default('manual'), // ex: 'manual' | 'gateway_x'
  channel: z.string().default('web'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
