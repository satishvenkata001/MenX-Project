import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { USER_ROLES } from '../config/constants.js';
import {
  getCustomersAdminHandler,
  getCustomerDetailsAdminHandler
} from '../controllers/adminCustomer.controller.js';

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

router.get('/customers', adminAuth, getCustomersAdminHandler);
router.get('/customers/:customerId', adminAuth, getCustomerDetailsAdminHandler);

export default router;
