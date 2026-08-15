import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { USER_ROLES } from '../config/constants.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

// Public Health Check
router.get('/', HealthController.getHealth);

// Protected Auth Verification Health Check
router.get('/auth', requireAuth, HealthController.getAuthHealth);

// Protected Role Verification Routes
router.get('/test/admin-only', requireAuth, requireRole(USER_ROLES.SUPER_ADMIN), (req, res) => {
  return sendSuccess(res, { roleVerified: 'SUPER_ADMIN' }, 'Super admin access authorized');
});

router.get('/test/customer-only', requireAuth, requireRole(USER_ROLES.CUSTOMER), (req, res) => {
  return sendSuccess(res, { roleVerified: 'CUSTOMER' }, 'Customer access authorized');
});

export default router;
