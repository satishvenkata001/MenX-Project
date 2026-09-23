import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

export const listDeliveryZonesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(25),
    search: z.string().trim().optional().or(z.literal('')),
    status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).default('ALL'),
    state: z.string().trim().optional().or(z.literal(''))
  })
});

export const createDeliveryZoneSchema = z.object({
  body: z.object({
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'PIN code must be exactly 6 numeric digits'),
    state: z.string().trim().min(1, 'State is required').default('Andhra Pradesh'),
    district: z.string().trim().optional().nullable(),
    isActive: z.boolean().default(true),
    baseDeliveryCharge: z.coerce.number().min(0, 'Base delivery charge cannot be negative').default(20.00),
    estimatedDaysMin: z.coerce.number().int().min(0).default(5),
    estimatedDaysMax: z.coerce.number().int().min(0).default(9)
  }).refine((data) => data.estimatedDaysMax >= data.estimatedDaysMin, {
    message: 'Estimated max days must be greater than or equal to min days',
    path: ['estimatedDaysMax']
  })
});

export const updateDeliveryZoneStatusSchema = z.object({
  params: z.object({
    id: uuidSchema
  }),
  body: z.object({
    isActive: z.boolean()
  })
});

export const deliveryZoneIdParamSchema = z.object({
  params: z.object({
    id: uuidSchema
  })
});
