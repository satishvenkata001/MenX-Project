import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

export const addToCartSchema = z.object({
  body: z.object({
    variantId: uuidSchema,
    quantity: z.number().int('Quantity must be an integer').positive('Quantity must be greater than 0').max(10, 'Maximum 10 units allowed per item in cart').optional().default(1),
    outfitId: uuidSchema.optional().nullable()
  })
});

export const updateCartItemSchema = z.object({
  params: z.object({
    id: uuidSchema
  }),
  body: z.object({
    quantity: z.number().int('Quantity must be an integer').positive('Quantity must be greater than 0').max(10, 'Maximum 10 units allowed per item in cart')
  })
});

export const mergeCartSchema = z.object({
  body: z.object({
    guestToken: z.string().min(32, 'Invalid guest token format').max(64, 'Invalid guest token format')
  })
});

export const addToWishlistSchema = z.object({
  body: z.object({
    productId: uuidSchema
  })
});

export const productIdParamSchema = z.object({
  params: z.object({
    productId: uuidSchema
  })
});
