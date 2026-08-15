import { HTTP_STATUS } from '../config/constants.js';

export class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad Request', details = null) {
    return new AppError(msg, HTTP_STATUS.BAD_REQUEST, details);
  }

  static unauthorized(msg = 'Unauthorized access', details = null) {
    return new AppError(msg, HTTP_STATUS.UNAUTHORIZED, details);
  }

  static forbidden(msg = 'Forbidden: Insufficient permissions', details = null) {
    return new AppError(msg, HTTP_STATUS.FORBIDDEN, details);
  }

  static notFound(msg = 'Resource not found', details = null) {
    return new AppError(msg, HTTP_STATUS.NOT_FOUND, details);
  }

  static conflict(msg = 'Resource conflict', details = null) {
    return new AppError(msg, HTTP_STATUS.CONFLICT, details);
  }

  static unprocessable(msg = 'Unprocessable entity', details = null) {
    return new AppError(msg, HTTP_STATUS.UNPROCESSABLE_ENTITY, details);
  }

  static internal(msg = 'Internal server error', details = null) {
    return new AppError(msg, HTTP_STATUS.INTERNAL_SERVER_ERROR, details);
  }
}
