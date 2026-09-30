import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdminOrStaff } from '../middleware/rbac.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validate.js';
import {
  ticketIdParamSchema,
  listTicketsQuerySchema,
  addTicketMessageSchema,
  transitionTicketStatusSchema,
  listSuggestionsQuerySchema,
  updateSuggestionStatusSchema
} from '../validators/support.validator.js';
import {
  listTicketsAdminHandler,
  getTicketDetailsAdminHandler,
  addAdminMessageHandler,
  transitionTicketStatusAdminHandler
} from '../controllers/adminSupport.controller.js';
import {
  listSuggestionsAdminHandler,
  updateSuggestionAdminHandler
} from '../controllers/suggestion.controller.js';

const router = Router();

// Protect all staff support & suggestions routes with auth, staff RBAC, and admin rate limiter
router.use(requireAuth, requireAdminOrStaff, adminLimiter);

// Staff Support Management Routes
router.get(
  ['/support/tickets', '/support'],
  validateRequest(listTicketsQuerySchema),
  listTicketsAdminHandler
);

router.get(
  ['/support/tickets/:ticketId', '/support/:ticketId'],
  validateRequest(ticketIdParamSchema),
  getTicketDetailsAdminHandler
);

router.post(
  [
    '/support/tickets/:ticketId/reply',
    '/support/tickets/:ticketId/messages',
    '/support/:ticketId/reply',
    '/support/:ticketId/messages'
  ],
  validateRequest(addTicketMessageSchema),
  addAdminMessageHandler
);

router.patch(
  [
    '/support/tickets/:ticketId/status',
    '/support/:ticketId/status'
  ],
  validateRequest(transitionTicketStatusSchema),
  transitionTicketStatusAdminHandler
);

// Staff Suggestions Management Routes
router.get(
  '/suggestions',
  validateRequest(listSuggestionsQuerySchema),
  listSuggestionsAdminHandler
);

router.patch(
  '/suggestions/:suggestionId',
  validateRequest(updateSuggestionStatusSchema),
  updateSuggestionAdminHandler
);

export default router;
