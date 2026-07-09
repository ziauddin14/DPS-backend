/**
 * A wrapper function that catches rejected promises in async middleware/controllers
 * and passes them to Express's global error handler via next().
 *
 * @param {Function} fn - Async controller function.
 * @returns {Function} Express middleware function.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
