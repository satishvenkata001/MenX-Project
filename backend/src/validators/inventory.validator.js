import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

export const inventoryQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
    limit: z.string().optional().transform(val => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20)),
    variantId: uuidSchema.optional(),
    sku: z.string().max(100).optional(),
    lowStockOnly: z.string().optional().transform(val => val === 'true'),
    search: z.string().max(100).optional()
  })
});

export const adjustStockSchema = z.object({
  body: z.object({
    variantId: uuidSchema,
    quantity: z.number().int('Quantity must be an integer').refine(q => q !== 0, {
      message: 'Adjustment quantity cannot be zero'
    }),
    movementType: z.enum([
      'INITIAL_STOCK',
      'PURCHASE_RECEIPT',
      'INVENTORY_ADJUSTMENT',
      'DAMAGED_WRITEOFF'
    ]).optional().default('INVENTORY_ADJUSTMENT'),
    referenceType: z.string().max(50).optional().default('MANUAL_ADJUSTMENT'),
    referenceId: uuidSchema.optional().nullable(),
    reason: z.string().min(1, 'Reason is required').max(500)
  })
});

export const reserveInventorySchema = z.object({
  body: z.object({
    variantId: uuidSchema,
    quantity: z.number().int().positive('Reservation quantity must be a positive integer'),
    orderId: uuidSchema
  })
});

export const stockMovementQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
    limit: z.string().optional().transform(val => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20)),
    variantId: uuidSchema.optional(),
    movementType: z.enum([
      'INITIAL_STOCK',
      'PURCHASE_RECEIPT',
      'ONLINE_ORDER_RESERVED',
      'ONLINE_ORDER_FULFILLED',
      'ONLINE_ORDER_CANCELLED',
      'POS_SALE',
      'POS_RETURN',
      'ONLINE_RETURN',
      'STOCK_TRANSFER',
      'INVENTORY_ADJUSTMENT',
      'DAMAGED_WRITEOFF'
    ]).optional(),
    referenceType: z.string().max(50).optional()
  })
});
