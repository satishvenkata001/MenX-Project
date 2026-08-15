import { env } from '../config/env.js';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const CURRENT_LEVEL = LOG_LEVELS[env.LOG_LEVEL] ?? LOG_LEVELS.info;

/**
 * Sanitizes objects to prevent printing sensitive credentials, passwords, or tokens in logs
 */
export const sanitizeForLogging = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging);
  }

  const sanitized = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('apikey')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      sanitized[key] = sanitizeForLogging(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
};

const formatMessage = (level, message, meta = null) => {
  const timestamp = new Date().toISOString();
  const metaString = meta ? ` | ${JSON.stringify(sanitizeForLogging(meta))}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
};

export const logger = {
  debug: (message, meta) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
      console.debug(formatMessage('debug', message, meta));
    }
  },
  info: (message, meta) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.info) {
      console.info(formatMessage('info', message, meta));
    }
  },
  warn: (message, meta) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  error: (message, meta) => {
    if (CURRENT_LEVEL <= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  }
};
