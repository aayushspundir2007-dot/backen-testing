const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { HttpStatus } = require('../constants/enums');

/**
 * Controller handling user registration and email verification
 */
class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/signup
   */
  signup = asyncHandler(async (req, res) => {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    const result = await authService.signup(req.body, context);

    res.status(HttpStatus.CREATED).json(
      ApiResponse.created(
        'User registered successfully. Please verify your email address to activate your account.',
        result
      )
    );
  });

  /**
   * Verify user email address with activation token
   * GET /api/v1/auth/verify-email?token=...
   */
  verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.query;
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    const result = await authService.verifyEmail(token, context);

    res.status(HttpStatus.OK).json(
      ApiResponse.success(
        result.message || 'Email verified successfully.',
        result
      )
    );
  });

  /**
   * Resend account verification email
   * POST /api/v1/auth/resend-verification
   */
  resendVerificationEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    const result = await authService.resendVerificationEmail(email, context);

    res.status(HttpStatus.OK).json(
      ApiResponse.success(result.message, result)
    );
  });

  /**
   * Authenticate user with credentials
   * POST /api/v1/auth/login
   */
  login = asyncHandler(async (req, res) => {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    const result = await authService.login(req.body, context);

    res.status(HttpStatus.OK).json(
      ApiResponse.success(result.message || 'Login successful.', result)
    );
  });
}

module.exports = new AuthController();
