import { Router } from 'express';
import { AdminExportController } from '../controllers/adminExport.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateRequest } from '../middleware/validate.js';
import { USER_ROLES } from '../config/constants.js';
import {
  exportProductsQuerySchema,
  exportOrdersQuerySchema
} from '../validators/adminExport.validator.js';

const router = Router();

// 1. Export Summary (Metadata & dataset counts) - Accessible by all authorized admin/manager roles
router.get(
  '/exports/summary',
  requireAuth,
  requireRole(
    USER_ROLES.INVENTORY_MANAGER,
    USER_ROLES.ORDER_MANAGER,
    USER_ROLES.STORE_MANAGER,
    USER_ROLES.SUPER_ADMIN
  ),
  AdminExportController.getSummary
);

// 2. Products & Stock Export - Accessible by inventory managers, store managers, super admins
router.get(
  '/exports/products',
  requireAuth,
  requireRole(
    USER_ROLES.INVENTORY_MANAGER,
    USER_ROLES.STORE_MANAGER,
    USER_ROLES.SUPER_ADMIN
  ),
  validateRequest(exportProductsQuerySchema),
  AdminExportController.exportProducts
);

// 3. Orders Export - Accessible by order managers, store managers, super admins
router.get(
  '/exports/orders',
  requireAuth,
  requireRole(
    USER_ROLES.ORDER_MANAGER,
    USER_ROLES.STORE_MANAGER,
    USER_ROLES.SUPER_ADMIN
  ),
  validateRequest(exportOrdersQuerySchema),
  AdminExportController.exportOrders
);

export default router;
