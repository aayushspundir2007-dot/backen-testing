const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { HttpStatus, ErrorCode } = require('../constants/enums');

/**
 * Error converter: converts non-ApiErrors into structured ApiErrors
 */
const errorConverter = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    // 1. Mongoose duplicate key error (code 11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'field';
      error = ApiError.conflict(
        `Duplicate value entered for ${field}. Please use another value.`,
        ErrorCode.DUPLICATE_RESOURCE,
        [{ field, message: `${field} must be unique.` }]
      );
    }
    // 2. Mongoose validation error
    else if (error instanceof mongoose.Error.ValidationError) {
      const errorDetails = Object.values(error.errors).map((el) => ({
        field: el.path,
        message: el.message,
      }));
      error = ApiError.badRequest(
        'Database validation failed',
        ErrorCode.VALIDATION_ERROR,
        errorDetails
      );
    }
    // 3. Mongoose CastError (e.g. invalid ObjectId)
    else if (error instanceof mongoose.Error.CastError) {
      error = ApiError.badRequest(
        `Invalid ${error.path}: ${error.value}`,
        ErrorCode.VALIDATION_ERROR
      );
    }
    // 4. JSON parse error
    else if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      error = ApiError.badRequest('Invalid JSON payload provided', ErrorCode.VALIDATION_ERROR);
    }
    // 5. Default fallback for generic unhandled errors
    else {
      const statusCode = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.message || 'Internal Server Error';
      error = new ApiError(statusCode, message, ErrorCode.INTERNAL_ERROR, [], false, err.stack);
    }
  }

  next(error);
};

/**
 * Global Error Handler Middleware
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message, errorCode, errors } = err;

  if (config.isProduction && !err.isOperational) {
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    message = 'Internal Server Error';
    errorCode = ErrorCode.INTERNAL_ERROR;
    errors = [];
  }

  const response = {
    success: false,
    statusCode,
    errorCode: errorCode || ErrorCode.INTERNAL_ERROR,
    message,
    ...(errors && errors.length > 0 ? { errors } : {}),
    ...(config.isDevelopment ? { stack: err.stack } : {}),
  };

  if (statusCode >= 500) {
    logger.error('Unhandled Server Exception:', err);
  }

  res.status(statusCode).json(response);
};

/**
 * 404 Route Not Found Middleware
 */
const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

module.exports = {
  errorConverter,
  errorHandler,
  notFoundHandler,
};
