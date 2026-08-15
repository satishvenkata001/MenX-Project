/**
 * Wraps async route handlers to automatically catch errors and pass them to next()
 * @param {Function} fn - Async controller function
 * @returns {Function} Express route middleware
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
