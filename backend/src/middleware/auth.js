import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

/**
 * Authentication Middleware
 * Extracts Supabase JWT from Authorization header, validates with Supabase Auth,
 * and fetches the user's active profile and role.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(AppError.unauthorized('Authentication required: Missing or malformed Bearer token'));
    }

    const token = authHeader.split(' ')[1];

    if (!token || token.trim() === '') {
      return next(AppError.unauthorized('Authentication required: Token cannot be empty'));
    }

    // Verify token with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      logger.debug('Auth token verification failed', { error: error?.message });
      return next(AppError.unauthorized('Invalid or expired authentication token'));
    }

    const user = data.user;

    // Fetch user's profile from database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.warn(`Profile record not found for authenticated user ID: ${user.id}`);
      return next(AppError.unauthorized('User profile not found. Please re-authenticate.'));
    }

    if (profile.is_active === false) {
      return next(AppError.forbidden('User account has been deactivated. Please contact support.'));
    }

    // Attach user, profile, and token to request object
    req.user = user;
    req.profile = profile;
    req.token = token;

    next();
  } catch (err) {
    logger.error('Unexpected error in auth middleware', { error: err.message });
    next(AppError.unauthorized('Authentication failed due to an internal error'));
  }
};

/**
 * Optional Auth Middleware
 * If token is present, verifies it and attaches profile; if absent, proceeds as guest.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.profile = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      req.profile = null;
      return next();
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      req.user = null;
      req.profile = null;
      return next();
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    req.user = data.user;
    req.profile = profile || null;
    req.token = token;

    next();
  } catch (err) {
    req.user = null;
    req.profile = null;
    next();
  }
};
