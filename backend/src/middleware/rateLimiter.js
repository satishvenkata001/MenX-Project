import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { isAuthorizedStaffRequest } from './auth.js';

/**
 * Resolves and normalizes the client IP for rate-limiting.
 * In production behind Cloudflare + Render, Cloudflare provides the verified client IP
 * in 'cf-connecting-ip'. If absent (e.g. direct traffic, health probes, or local dev),
 * it safely falls back to Express-resolved 'req.ip' (governed by app.set('trust proxy', 1)).
 *
 * Normalizes IPv4-mapped IPv6 (::ffff:x.x.x.x -> x.x.x.x) and case/trimming for
 * consistent bucket keys across IPv4 and IPv6 clients.
 */
export const keyGenerator = (req) => {
  const rawIp =
    req.headers['cf-connecting-ip'] ||
    req.ip;

  if (!rawIp) {
    return '127.0.0.1';
  }

  const clientIp = (Array.isArray(rawIp) ? rawIp[0] : String(rawIp))
    .split(',')[0]
    .trim()
    .toLowerCase();

  // Normalize IPv4-mapped IPv6 addresses (e.g. ::ffff:192.0.2.1 -> 192.0.2.1)
  if (clientIp.startsWith('::ffff:') && clientIp.includes('.')) {
    return clientIp.slice(7);
  }

  return clientIp;
};

/**
 * 1. Public Customer API Limiter (600 requests / 15 minutes)
 * Accommodates rich SPA browsing, filtering, searching, cart, and shared household IPs.
 * Skips dedicated sub-limiter routes (auth credentials, token refresh, order creation, authorized staff admin calls).
 */
export const publicLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: async (req) => {
    // 1. Health check bypass
    if (req.path === '/health' || req.path === '/api/v1/health') {
      return true;
    }

    const path = req.originalUrl || req.url || '';

    // 2. Auth credential endpoints handled by authLimiter
    if (
      req.method === 'POST' &&
      /(?:^|\/)auth\/(?:login|signup|password-reset|exchange-code|verify-otp|resend-verification|resend-otp)(?:$|\?)/.test(path)
    ) {
      return true;
    }

    // 3. Token refresh handled by refreshLimiter
    if (
      req.method === 'POST' &&
      /(?:^|\/)auth\/refresh(?:$|\?)/.test(path)
    ) {
      return true;
    }

    // 4. Order creation handled by orderLimiter
    if (
      req.method === 'POST' &&
      /(?:^|\/)orders(?:$|\?)/.test(path)
    ) {
      return true;
    }

    // 5. Admin / staff requests handled by adminLimiter if authenticated as authorized staff
    if (/(?:^|\/)admin(?:$|\/|\?)/.test(path)) {
      const isStaff = await isAuthorizedStaffRequest(req);
      if (isStaff) {
        return true; // Staff receives adminLimiter (1500/15m) instead
      }
      // Non-staff hitting /admin is NOT skipped -> counted against publicLimiter (600/15m)
    }

    return false;
  },
  handler: (req, res, next) => {
    next(
      AppError.tooManyRequests(
        `Too many requests from this IP. Please try again after ${Math.ceil(
          env.RATE_LIMIT_WINDOW_MS / 60000
        )} minutes.`
      )
    );
  }
});

// Backward compatibility alias for existing code/tests
export const globalLimiter = publicLimiter;

/**
 * 2. Dedicated Authenticated Admin / Staff API Limiter (1500 requests / 15 minutes)
 * Applied to authenticated staff operations (catalog management, variant creation, inventory, orders, exports).
 */
export const adminLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.ADMIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res, next) => {
    next(
      AppError.tooManyRequests(
        `Too many administrative requests from this IP. Please try again after ${Math.ceil(
          env.RATE_LIMIT_WINDOW_MS / 60000
        )} minutes.`
      )
    );
  }
});

/**
 * 3. Strict Rate Limiter for Sensitive Auth Credential Endpoints (Login, Signup, Reset)
 * 15 requests / 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res, next) => {
    next(
      AppError.tooManyRequests(
        'Too many authentication attempts from this IP. Please try again after 15 minutes.'
      )
    );
  }
});

/**
 * 4. Dedicated Token Refresh Limiter (60 requests / 15 minutes)
 * Separated from authLimiter so background token renewals do not consume login credential quota.
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.REFRESH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res, next) => {
    next(
      AppError.tooManyRequests(
        'Too many token refresh requests from this IP. Please try again after 15 minutes.'
      )
    );
  }
});

/**
 * 5. Dedicated Order Creation Limiter (5 requests / 1 minute)
 * Protects against automated COD order flooding while keeping normal browsing unconstrained.
 */
export const orderLimiter = rateLimit({
  windowMs: env.ORDER_RATE_LIMIT_WINDOW_MS,
  max: env.ORDER_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res, next) => {
    next(
      AppError.tooManyRequests(
        'Too many order creation attempts from this IP. Please wait a minute before trying again.'
      )
    );
  }
});

