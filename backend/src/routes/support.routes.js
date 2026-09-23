import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createSupportTicketSchema,
  addTicketMessageSchema,
  ticketIdParamSchema,
  listTicketsQuerySchema,
  createSuggestionSchema
} from '../validators/support.validator.js';
import {
  createTicketHandler,
  getCustomerTicketsHandler,
  getCustomerTicketDetailsHandler,
  addCustomerMessageHandler
} from '../controllers/support.controller.js';
import { createSuggestionHandler } from '../controllers/suggestion.controller.js';

const router = Router();

// Customer Support Ticket Creation
router.post(
  ['/support/tickets', '/support'],
  requireAuth,
  validateRequest(createSupportTicketSchema),
  createTicketHandler
);

// Customer Support Tickets Listing
router.get(
  ['/support/tickets', '/support'],
  requireAuth,
  validateRequest(listTicketsQuerySchema),
  getCustomerTicketsHandler
);

// Customer Support Ticket Details
router.get(
  ['/support/tickets/:ticketId', '/support/:ticketId'],
  requireAuth,
  validateRequest(ticketIdParamSchema),
  getCustomerTicketDetailsHandler
);

// Customer Reply to Ticket
router.post(
  [
    '/support/tickets/:ticketId/reply',
    '/support/tickets/:ticketId/messages',
    '/support/:ticketId/reply',
    '/support/:ticketId/messages'
  ],
  requireAuth,
  validateRequest(addTicketMessageSchema),
  addCustomerMessageHandler
);

// Customer Suggestions / Feedback Route (Authenticated or Guest)
router.post(
  '/suggestions',
  optionalAuth,
  validateRequest(createSuggestionSchema),
  createSuggestionHandler
);

export default router;
