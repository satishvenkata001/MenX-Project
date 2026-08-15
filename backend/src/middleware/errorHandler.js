import { env } from '../config/env.js';
import { HTTP_STATUS } from '../config/constants.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert raw errors to AppError if not already an instance
  if (!(error instanceof AppError)) {
    // Handle Supabase/Postgres Unique Constraint Violation
    if (error.code === '23505') {
      error = AppError.conflict('A record with these details already exists.');
    }
    // Handle Postgres Foreign Key Violation
    else if (error.code === '23503') {
      error = AppError.badRequest('Referenced entity does not exist.');
    }
    // Handle Postgres Permission Denied / RLS Violation
    else if (error.code === '42501') {
      error = AppError.forbidden('You do not have permission to perform this database operation.');
    }
    // Handle JWT / Auth Errors
    else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error = AppError.unauthorized('Invalid or expired authentication token.');
    }
    // Handle Body Parser Syntax Errors
    else if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      error = AppError.badRequest('Invalid JSON payload in request body.');
    }
    // Default fallback internal error
    else {
      logger.error('Unhandled System Exception:', {
        message: error.message,
        stack: error.stack,
        path: req.originalUrl,
        method: req.method
      });
      error = AppError.internal(
        env.NODE_ENV === 'production' ? 'An unexpected internal server error occurred.' : error.message
      );
    }
  }

  const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const status = error.status || 'error';

  const response = {
    status,
    statusCode,
    message: error.message,
    ...(error.details && { details: error.details }),
    ...(env.NODE_ENV === 'development' && { stack: error.stack })
  };

  res.status(statusCode).json(response);
};
