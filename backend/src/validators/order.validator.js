import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

export const validateCheckoutSchema = z.object({
  body: z.object({
    addressId: uuidSchema,
    couponCode: z.string().trim().min(1, 'Coupon code cannot be empty').optional()
  })
});

export const createOrderSchema = z.object({
  body: z.object({
    addressId: uuidSchema,
    couponCode: z.string().trim().min(1, 'Coupon code cannot be empty').optional(),
    customerNotes: z.string().max(500, 'Customer notes cannot exceed 500 characters').optional(),
    paymentMethod: z.literal('COD', {
      errorMap: () => ({ message: 'Payment method must be COD' })
    })
  })
});

export const orderIdParamSchema = z.object({
  params: z.object({
    orderId: uuidSchema
  })
});

export const cancelOrderSchema = z.object({
  params: z.object({
    orderId: uuidSchema
  }),
  body: z.object({
    reason: z.string().max(255, 'Cancellation reason cannot exceed 255 characters').optional()
  })
});
