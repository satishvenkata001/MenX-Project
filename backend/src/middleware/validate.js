import { AppError } from '../utils/appError.js';

/**
 * Validates Express request against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate (e.g. { body, query, params })
 */
export const validateRequest = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));

      return next(
        AppError.badRequest('Validation failed: Invalid request parameters', formattedErrors)
      );
    }

    // Assign sanitized / parsed data back to req
    if (result.data.body) req.body = result.data.body;
    if (result.data.query) req.query = result.data.query;
    if (result.data.params) req.params = result.data.params;

    next();
  } catch (err) {
    next(err);
  }
};
