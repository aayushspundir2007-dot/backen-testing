/**
 * Wraps asynchronous route handlers and middleware to automatically catch unhandled rejections
 * and pass them to the Express error middleware.
 *
 * @param {Function} fn - Async express route handler or middleware
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
