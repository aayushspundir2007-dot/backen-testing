const { HttpStatus, ErrorCode } = require('../constants/enums');

/**
 * Custom Operational Error Class for structured enterprise error handling
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human-readable error message
   * @param {string} [errorCode=ErrorCode.INTERNAL_ERROR] - Machine-readable error code
   * @param {Array|Object} [errors=[]] - Detailed validation or contextual error items
   * @param {boolean} [isOperational=true] - Whether the error is an expected operational error
   * @param {string} [stack=''] - Optional stack trace
   */
  constructor(
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    message = 'An unexpected error occurred',
    errorCode = ErrorCode.INTERNAL_ERROR,
    errors = [],
    isOperational = true,
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.isOperational = isOperational;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message, errorCode = ErrorCode.VALIDATION_ERROR, errors = []) {
    return new ApiError(HttpStatus.BAD_REQUEST, message, errorCode, errors);
  }

  static unauthorized(message = 'Unauthorized access', errorCode = 'UNAUTHORIZED') {
    return new ApiError(HttpStatus.UNAUTHORIZED, message, errorCode);
  }

  static forbidden(message = 'Access forbidden', errorCode = 'FORBIDDEN') {
    return new ApiError(HttpStatus.FORBIDDEN, message, errorCode);
  }

  static notFound(message = 'Resource not found', errorCode = ErrorCode.RESOURCE_NOT_FOUND) {
    return new ApiError(HttpStatus.NOT_FOUND, message, errorCode);
  }

  static conflict(message = 'Resource already exists', errorCode = ErrorCode.DUPLICATE_RESOURCE) {
    return new ApiError(HttpStatus.CONFLICT, message, errorCode);
  }

  static tooManyRequests(message = 'Too many requests, please try again later', errorCode = ErrorCode.RATE_LIMIT_EXCEEDED) {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, message, errorCode);
  }

  static internal(message = 'Internal server error', errorCode = ErrorCode.INTERNAL_ERROR) {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, message, errorCode, [], false);
  }
}

module.exports = ApiError;
