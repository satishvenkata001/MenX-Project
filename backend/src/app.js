import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/appError.js';
import apiRoutes from './routes/index.js';

const app = express();

// 1. Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

/**
 * Helper to check if a hostname is a valid local development or LAN private network host.
 * Covers:
 * - Loopback: localhost, 127.0.0.1, ::1, [::1]
 * - RFC 1918 Private IPv4:
 *   - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
 *   - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 *   - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 * - RFC 3927 Link-Local IPv4: 169.254.0.0/16
 * - Local mDNS / Bonjour domains: *.local
 */
const isDevAllowedHost = (hostname) => {
  if (!hostname) return false;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return true;
  }
  if (
    /^10\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(hostname) ||
    /^172\.(?:1[6-9]|2\d|3[0-1])\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(hostname) ||
    /^192\.168\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(hostname) ||
    /^169\.254\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(hostname) ||
    hostname.endsWith('.local')
  ) {
    return true;
  }
  return false;
};

const configuredOrigins = (env.FRONTEND_URL ? env.FRONTEND_URL.split(',').map(s => s.trim()) : []).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile native apps, curl, or server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // In development ONLY, dynamically allow localhost, 127.0.0.1, ::1, and private LAN IP / local network ranges
    if (env.NODE_ENV === 'development') {
      try {
        const parsedUrl = new URL(origin);
        if (isDevAllowedHost(parsedUrl.hostname)) {
          return callback(null, true);
        }
      } catch {
        // Safe fallback on URL parsing error
      }
    }

    // Check explicitly configured allowed origins (e.g. FRONTEND_URL)
    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Clean CORS rejection without throwing an unhandled HTTP 500 error
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Guest-Token', 'x-guest-token']
}));

// 3. Body Parsing Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Request Logging Middleware
app.use(requestLogger);

// 5. Global Rate Limiting
app.use('/api', globalLimiter);

// 6. Mount REST API v1
app.use('/api/v1', apiRoutes);

// 7. Undefined Route (404) Handler
app.use('*', (req, res, next) => {
  next(AppError.notFound(`Route '${req.originalUrl}' not found on this server`));
});

// 8. Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
