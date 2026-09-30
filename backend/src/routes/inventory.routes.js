import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validate.js';
import { USER_ROLES } from '../config/constants.js';
import { idParamSchema } from '../validators/catalog.validator.js';
import {
  adjustStockSchema,
  inventoryQuerySchema,
  reserveInventorySchema,
  stockMovementQuerySchema
} from '../validators/inventory.validator.js';

const router = Router();

// Protect all inventory routes with authentication, manager / admin RBAC, and admin rate limiter
router.use(
  requireAuth,
  requireRole(
    USER_ROLES.INVENTORY_MANAGER,
    USER_ROLES.STORE_MANAGER,
    USER_ROLES.SUPER_ADMIN
  ),
  adminLimiter
);

// Inventory Queries
router.get('/inventory', validateRequest(inventoryQuerySchema), InventoryController.listInventory);
router.get('/inventory/low-stock', validateRequest(inventoryQuerySchema), InventoryController.getLowStock);
router.get('/inventory/movements', validateRequest(stockMovementQuerySchema), InventoryController.listStockMovements);
router.get('/inventory/:id', validateRequest(idParamSchema), InventoryController.getInventoryById);

// Inventory Mutations
router.post('/inventory/adjust', validateRequest(adjustStockSchema), InventoryController.adjustStock);
router.post('/inventory/reserve', validateRequest(reserveInventorySchema), InventoryController.reserveInventory);

export default router;
