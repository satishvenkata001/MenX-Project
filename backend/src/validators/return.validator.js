import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

export const createReturnSchema = z.object({
  body: z.object({
    orderId: uuidSchema,
    requestType: z.enum(['RETURN', 'EXCHANGE'], {
      errorMap: () => ({ message: "Request type must be 'RETURN' or 'EXCHANGE'" })
    }),
    reason: z.enum(['WRONG_SIZE', 'DEFECTIVE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'QUALITY_ISSUE', 'OTHER'], {
      errorMap: () => ({ message: 'Invalid return reason specified' })
    }),
    customerComment: z.string().max(1000, 'Customer comment cannot exceed 1000 characters').optional(),
    items: z.array(
      z.object({
        orderItemId: uuidSchema,
        variantId: uuidSchema,
        quantity: z.number().int().positive('Quantity must be positive'),
        replacementVariantId: uuidSchema.nullable().optional()
      })
    ).nonempty('At least one return item must be specified')
  })
});

export const returnIdParamSchema = z.object({
  params: z.object({
    returnId: uuidSchema
  })
});

export const transitionReturnStatusSchema = z.object({
  params: z.object({
    returnId: uuidSchema
  }),
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'RECEIVED_IN_STORE', 'COMPLETED', 'CANCELLED'], {
      errorMap: () => ({ message: 'Invalid status transition specified' })
    }),
    comment: z.string().max(1000, 'Comment cannot exceed 1000 characters').optional(),
    itemsCondition: z.array(
      z.object({
        returnItemId: uuidSchema,
        condition: z.string().max(50, 'Condition cannot exceed 50 characters')
      })
    ).optional()
  })
});

export const listReturnsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'RECEIVED_IN_STORE', 'COMPLETED', 'CANCELLED']).optional(),
    storeId: uuidSchema.optional(),
    search: z.string().optional()
  }).optional()
});
