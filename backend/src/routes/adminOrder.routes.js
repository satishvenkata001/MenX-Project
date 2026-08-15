import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateRequest } from '../middleware/validate.js';
import { USER_ROLES } from '../config/constants.js';
import {
  updateOrderStatusSchema,
  codCollectionSchema
} from '../validators/adminOrder.validator.js';
import {
  getOrdersAdminHandler,
  getOrderDetailsAdminHandler,
  updateOrderStatusHandler,
  recordCodCollectionHandler
} from '../controllers/adminOrder.controller.js';

const router = Router();

const adminAuth = [
  requireAuth,
  requireRole(
    USER_ROLES.STORE_STAFF,
    USER_ROLES.ORDER_MANAGER,
    USER_ROLES.STORE_MANAGER,
    USER_ROLES.SUPER_ADMIN
  )
];

router.get('/admin/orders', adminAuth, getOrdersAdminHandler);
router.get('/admin/orders/:orderId', adminAuth, getOrderDetailsAdminHandler);
router.patch('/admin/orders/:orderId/status', adminAuth, validateRequest(updateOrderStatusSchema), updateOrderStatusHandler);
router.post('/admin/orders/:orderId/cod-collection', adminAuth, validateRequest(codCollectionSchema), recordCodCollectionHandler);

export default router;
