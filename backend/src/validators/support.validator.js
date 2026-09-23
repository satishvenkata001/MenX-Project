import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

export const SUPPORT_CATEGORIES = [
  'ORDER',
  'ORDERS_FULFILLMENT',
  'SHIPPING',
  'PAYMENT',
  'PAYMENTS_REFUNDS',
  'RETURN',
  'RETURNS_EXCHANGES',
  'EXCHANGE',
  'PRODUCT',
  'PRODUCT_INQUIRY',
  'ACCOUNT',
  'ACCOUNT_SETTINGS',
  'CART_WISHLIST',
  'OTHER'
];

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const SUGGESTION_STATUSES = ['NEW', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED', 'REVIEWED', 'RESOLVED'];

export const createSupportTicketSchema = z.object({
  body: z.object({
    subject: z
      .string({ required_error: 'Subject is required' })
      .trim()
      .min(3, 'Subject must be at least 3 characters')
      .max(255, 'Subject cannot exceed 255 characters'),
    category: z.enum(SUPPORT_CATEGORIES, {
      errorMap: () => ({ message: 'Invalid support category specified' })
    }),
    message: z
      .string({ required_error: 'Message is required' })
      .trim()
      .min(5, 'Message must be at least 5 characters')
      .max(5000, 'Message cannot exceed 5000 characters'),
    orderNumber: z.string().trim().max(100, 'Order number too long').nullable().optional(),
    orderId: uuidSchema.nullable().optional()
  })
});

export const addTicketMessageSchema = z.object({
  params: z.object({
    ticketId: uuidSchema
  }),
  body: z.object({
    message: z
      .string({ required_error: 'Message is required' })
      .trim()
      .min(1, 'Message cannot be empty')
      .max(5000, 'Message cannot exceed 5000 characters')
  })
});

export const ticketIdParamSchema = z.object({
  params: z.object({
    ticketId: uuidSchema
  })
});

export const listTicketsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    category: z.enum(SUPPORT_CATEGORIES).optional(),
    search: z.string().optional()
  }).optional()
});

export const transitionTicketStatusSchema = z.object({
  params: z.object({
    ticketId: uuidSchema
  }),
  body: z.object({
    status: z.enum(TICKET_STATUSES, {
      errorMap: () => ({ message: 'Invalid ticket status specified' })
    }),
    comment: z.string().max(1000, 'Comment cannot exceed 1000 characters').nullable().optional(),
    note: z.string().max(1000, 'Note cannot exceed 1000 characters').nullable().optional()
  })
});

export const createSuggestionSchema = z.object({
  body: z.object({
    message: z
      .string({ required_error: 'Suggestion message is required' })
      .trim()
      .min(5, 'Suggestion message must be at least 5 characters')
      .max(3000, 'Suggestion cannot exceed 3000 characters')
  })
});

export const updateSuggestionStatusSchema = z.object({
  params: z.object({
    suggestionId: uuidSchema
  }),
  body: z.object({
    status: z.enum(SUGGESTION_STATUSES, {
      errorMap: () => ({ message: 'Invalid suggestion status specified' })
    }),
    adminNote: z.string().max(2000, 'Admin note cannot exceed 2000 characters').nullable().optional()
  })
});

export const listSuggestionsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(SUGGESTION_STATUSES).optional(),
    search: z.string().optional()
  }).optional()
});
