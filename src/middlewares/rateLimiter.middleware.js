const rateLimit = require('express-rate-limit');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { ErrorCode } = require('../constants/enums');

/**
 * Standard global API rate limiter
 */
const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many requests from this IP address. Please try again later.',
        ErrorCode.RATE_LIMIT_EXCEEDED
      )
    );
  },
});

/**
 * Stricter Rate Limiter for Authentication & Registration Endpoints
 * (Mitigates brute-force attacks and account creation flooding)
 */
const authRateLimiter = rateLimit({
  windowMs: config.rateLimit.signup.windowMs,
  max: config.rateLimit.signup.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many signup or verification attempts from this IP. Please try again later.',
        ErrorCode.RATE_LIMIT_EXCEEDED
      )
    );
  },
});

module.exports = {
  globalRateLimiter,
  authRateLimiter,
};
