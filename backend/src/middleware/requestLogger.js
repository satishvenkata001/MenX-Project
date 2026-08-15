import { logger } from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    let clientIp = 'unknown';
    try {
      clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    } catch (e) {}

    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: clientIp
    };

    if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`, logData);
    } else {
      logger.info(`HTTP ${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`, logData);
    }
  });

  next();
};
