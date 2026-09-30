import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validate.js';
import { USER_ROLES } from '../config/constants.js';
import {
  listDeliveryZonesQuerySchema,
  createDeliveryZoneSchema,
  updateDeliveryZoneStatusSchema,
  deliveryZoneIdParamSchema
} from '../validators/adminDeliveryZone.validator.js';
import {
  listDeliveryZonesAdminHandler,
  createDeliveryZoneAdminHandler,
  updateDeliveryZoneStatusAdminHandler,
  deleteDeliveryZoneAdminHandler
} from '../controllers/adminDeliveryZone.controller.js';

const router = Router();

const adminAuth = [
  requireAuth,
  requireRole(
    USER_ROLES.STORE_STAFF,
    USER_ROLES.INVENTORY_MANAGER,
    USER_ROLES.ORDER_MANAGER,
    USER_ROLES.STORE_MANAGER,
    USER_ROLES.SUPER_ADMIN
  ),
  adminLimiter
];

/**
 * GET /api/v1/admin/delivery-zones
 */
router.get(
  '/delivery-zones',
  adminAuth,
  validateRequest(listDeliveryZonesQuerySchema),
  listDeliveryZonesAdminHandler
);

/**
 * POST /api/v1/admin/delivery-zones
 */
router.post(
  '/delivery-zones',
  adminAuth,
  validateRequest(createDeliveryZoneSchema),
  createDeliveryZoneAdminHandler
);

/**
 * PATCH /api/v1/admin/delivery-zones/:id/status
 */
router.patch(
  '/delivery-zones/:id/status',
  adminAuth,
  validateRequest(updateDeliveryZoneStatusSchema),
  updateDeliveryZoneStatusAdminHandler
);

/**
 * DELETE /api/v1/admin/delivery-zones/:id
 */
router.delete(
  '/delivery-zones/:id',
  adminAuth,
  validateRequest(deliveryZoneIdParamSchema),
  deleteDeliveryZoneAdminHandler
);

export default router;
