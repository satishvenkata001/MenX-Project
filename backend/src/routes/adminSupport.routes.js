import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdminOrStaff } from '../middleware/rbac.js';
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

// Staff Support Management Routes
router.get(
  ['/support/tickets', '/support'],
  requireAuth,
  requireAdminOrStaff,
  validateRequest(listTicketsQuerySchema),
  listTicketsAdminHandler
);

router.get(
  ['/support/tickets/:ticketId', '/support/:ticketId'],
  requireAuth,
  requireAdminOrStaff,
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
  requireAuth,
  requireAdminOrStaff,
  validateRequest(addTicketMessageSchema),
  addAdminMessageHandler
);

router.patch(
  [
    '/support/tickets/:ticketId/status',
    '/support/:ticketId/status'
  ],
  requireAuth,
  requireAdminOrStaff,
  validateRequest(transitionTicketStatusSchema),
  transitionTicketStatusAdminHandler
);

// Staff Suggestions Management Routes
router.get(
  '/suggestions',
  requireAuth,
  requireAdminOrStaff,
  validateRequest(listSuggestionsQuerySchema),
  listSuggestionsAdminHandler
);

router.patch(
  '/suggestions/:suggestionId',
  requireAuth,
  requireAdminOrStaff,
  validateRequest(updateSuggestionStatusSchema),
  updateSuggestionAdminHandler
);

export default router;
