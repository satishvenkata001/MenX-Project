import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';

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
 * Standard API Global Rate Limiter
 */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
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

/**
 * Strict Rate Limiter for Sensitive Auth Endpoints (Login, Signup, Reset)
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
