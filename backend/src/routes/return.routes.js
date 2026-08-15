import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdminOrStaff } from '../middleware/rbac.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createReturnSchema,
  returnIdParamSchema,
  transitionReturnStatusSchema,
  listReturnsQuerySchema
} from '../validators/return.validator.js';
import {
  getEligibleItemsHandler,
  createReturnRequestHandler,
  getReturnsHandler,
  getReturnDetailsHandler,
  cancelReturnHandler,
  listReturnsAdminHandler,
  getReturnDetailsAdminHandler,
  transitionReturnStatusHandler
} from '../controllers/return.controller.js';

const router = Router();

// Customer Endpoints (Require requireAuth)
router.get('/returns/eligible-items', requireAuth, getEligibleItemsHandler);
router.post('/returns', requireAuth, validateRequest(createReturnSchema), createReturnRequestHandler);
router.get('/returns', requireAuth, getReturnsHandler);
router.get('/returns/:returnId', requireAuth, validateRequest(returnIdParamSchema), getReturnDetailsHandler);
router.post('/returns/:returnId/cancel', requireAuth, validateRequest(returnIdParamSchema), cancelReturnHandler);

// Admin / Staff Endpoints (Require requireAuth and requireAdminOrStaff)
router.get('/admin/returns', requireAuth, requireAdminOrStaff, validateRequest(listReturnsQuerySchema), listReturnsAdminHandler);
router.get('/admin/returns/:returnId', requireAuth, requireAdminOrStaff, validateRequest(returnIdParamSchema), getReturnDetailsAdminHandler);
router.post('/admin/returns/:returnId/status', requireAuth, requireAdminOrStaff, validateRequest(transitionReturnStatusSchema), transitionReturnStatusHandler);

export default router;
