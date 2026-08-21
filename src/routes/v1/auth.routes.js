const express = require('express');
const authController = require('../../controllers/auth.controller');
const authValidation = require('../../validations/auth.validation');
const validate = require('../../middlewares/validate.middleware');
const { authRateLimiter } = require('../../middlewares/rateLimiter.middleware');

const router = express.Router();

/**
 * @route   POST /api/v1/auth/signup
 * @desc    Register a new user account
 * @access  Public
 */
router.post(
  '/signup',
  authRateLimiter,
  validate(authValidation.signup),
  authController.signup
);

/**
 * @route   GET /api/v1/auth/verify-email
 * @desc    Verify email address using token sent via email
 * @access  Public
 */
router.get(
  '/verify-email',
  validate(authValidation.verifyEmail),
  authController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend account verification email (subject to cooldown)
 * @access  Public
 */
router.post(
  '/resend-verification',
  authRateLimiter,
  validate(authValidation.resendVerification),
  authController.resendVerificationEmail
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and log in
 * @access  Public
 */
router.post(
  '/login',
  authRateLimiter,
  validate(authValidation.login),
  authController.login
);

module.exports = router;
