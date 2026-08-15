import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';

/**
 * Standard API Global Rate Limiter
 */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      AppError.forbidden(
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
  handler: (req, res, next) => {
    next(
      AppError.forbidden(
        'Too many authentication attempts from this IP. Please try again after 15 minutes.'
      )
    );
  }
});
