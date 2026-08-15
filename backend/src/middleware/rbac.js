import { USER_ROLES } from '../config/constants.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks if authenticated user's profile has one of the required roles.
 * Must be mounted AFTER requireAuth.
 * @param  {...string} allowedRoles - Permitted user roles
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.profile || !req.profile.role) {
      logger.warn('RBAC check invoked without authenticated profile');
      return next(AppError.unauthorized('Authentication required'));
    }

    const userRole = req.profile.role;

    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Access denied: User role '${userRole}' not in allowed roles: [${allowedRoles.join(', ')}]`);
      return next(
        AppError.forbidden(`Access forbidden: Role '${userRole}' lacks required permissions`)
      );
    }

    next();
  };
};

/**
 * Convenience helper for all internal staff & admin roles
 */
export const requireAdminOrStaff = requireRole(
  USER_ROLES.STORE_STAFF,
  USER_ROLES.INVENTORY_MANAGER,
  USER_ROLES.ORDER_MANAGER,
  USER_ROLES.STORE_MANAGER,
  USER_ROLES.SUPER_ADMIN
);

/**
 * Convenience helper for managerial and superadmin operations
 */
export const requireManagerOrAdmin = requireRole(
  USER_ROLES.INVENTORY_MANAGER,
  USER_ROLES.ORDER_MANAGER,
  USER_ROLES.STORE_MANAGER,
  USER_ROLES.SUPER_ADMIN
);

/**
 * Convenience helper strictly for superadmin operations
 */
export const requireSuperAdmin = requireRole(USER_ROLES.SUPER_ADMIN);
