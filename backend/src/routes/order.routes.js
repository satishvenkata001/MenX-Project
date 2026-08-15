import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  validateCheckoutSchema,
  createOrderSchema,
  orderIdParamSchema,
  cancelOrderSchema
} from '../validators/order.validator.js';
import {
  validateCheckoutHandler,
  createOrderHandler,
  getOrdersHandler,
  getOrderDetailsHandler,
  getOrderStatusHistoryHandler,
  cancelOrderHandler
} from '../controllers/order.controller.js';

const router = Router();

// All customer endpoints require authentication
router.post('/checkout/validate', requireAuth, validateRequest(validateCheckoutSchema), validateCheckoutHandler);
router.post('/orders', requireAuth, validateRequest(createOrderSchema), createOrderHandler);
router.get('/orders', requireAuth, getOrdersHandler);
router.get('/orders/:orderId', requireAuth, validateRequest(orderIdParamSchema), getOrderDetailsHandler);
router.post('/orders/:orderId/cancel', requireAuth, validateRequest(cancelOrderSchema), cancelOrderHandler);
router.get('/orders/:orderId/status-history', requireAuth, validateRequest(orderIdParamSchema), getOrderStatusHistoryHandler);

export default router;
