import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

export const exportProductsQuerySchema = z.object({
  query: z.object({
    format: z.enum(['csv', 'xlsx']).default('csv'),
    status: z.enum(['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    categoryId: z.string().uuid('Invalid category ID format').optional().or(z.literal('')),
    stockStatus: z.enum(['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).optional()
  })
});

export const exportOrdersQuerySchema = z.object({
  query: z.object({
    format: z.enum(['csv', 'xlsx']).default('csv'),
    fromDate: z.string().regex(dateRegex, 'Invalid fromDate format (expected YYYY-MM-DD)').optional().or(z.literal('')),
    toDate: z.string().regex(dateRegex, 'Invalid toDate format (expected YYYY-MM-DD)').optional().or(z.literal('')),
    orderStatus: z.enum(['ALL', 'PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'FAILED_DELIVERY']).optional().or(z.literal(''))
  }).refine((data) => {
    if (data.fromDate && data.toDate) {
      const from = new Date(data.fromDate).getTime();
      const to = new Date(data.toDate).getTime();
      return from <= to;
    }
    return true;
  }, {
    message: 'fromDate must be earlier than or equal to toDate',
    path: ['fromDate']
  })
});
