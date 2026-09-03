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

const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // In development, dynamically allow any port on localhost, 127.0.0.1, or the local LAN IP
    if (env.NODE_ENV === 'development') {
      try {
        const parsedUrl = new URL(origin);
        const hostname = parsedUrl.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '10.197.179.122') {
          return callback(null, true);
        }
      } catch (err) {
        // Safe fallback on URL parsing error
      }
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
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
