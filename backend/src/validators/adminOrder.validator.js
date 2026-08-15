import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

export const updateOrderStatusSchema = z.object({
  params: z.object({
    orderId: uuidSchema
  }),
  body: z.object({
    status: z.enum([
      'PENDING',
      'CONFIRMED',
      'PACKED',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'FAILED_DELIVERY',
      'RETURN_REQUESTED',
      'RETURNED'
    ], {
      errorMap: () => ({ message: 'Invalid order status' })
    })
  })
});

export const codCollectionSchema = z.object({
  params: z.object({
    orderId: uuidSchema
  }),
  body: z.object({
    amountCollected: z.number({
      required_error: 'Amount collected is required',
      invalid_type_error: 'Amount collected must be a number'
    }).min(0, 'Amount collected must be greater than or equal to 0')
  })
});
