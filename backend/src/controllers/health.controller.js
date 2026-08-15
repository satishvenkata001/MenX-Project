import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export class HealthController {
  /**
   * GET /api/v1/health (Public)
   */
  static getHealth = asyncHandler(async (req, res) => {
    return sendSuccess(res, {
      status: 'UP',
      app: 'MENX REST API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV
    }, 'MENX Backend Service is healthy and operational.');
  });

  /**
   * GET /api/v1/health/auth (Protected Verification Endpoint)
   */
  static getAuthHealth = asyncHandler(async (req, res) => {
    return sendSuccess(res, {
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email
      },
      profile: {
        role: req.profile.role,
        isActive: req.profile.is_active,
        firstName: req.profile.first_name,
        lastName: req.profile.last_name
      },
      timestamp: new Date().toISOString()
    }, 'Authentication and RBAC verification successful.');
  });
}
