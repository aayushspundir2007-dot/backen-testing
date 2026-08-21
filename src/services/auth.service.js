const userRepository = require('../repositories/user.repository');
const tokenRepository = require('../repositories/token.repository');
const auditLogRepository = require('../repositories/auditLog.repository');
const emailService = require('./email.service');
const CryptoUtils = require('../utils/crypto');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const { AccountStatus, TokenType, AuditAction, ErrorCode } = require('../constants/enums');
const logger = require('../utils/logger');

/**
 * Enterprise Authentication & Signup Business Logic Service
 */
class AuthService {
  /**
   * Register a new user and initiate email verification flow
   *
   * @param {Object} payload - User registration parameters
   * @param {Object} context - Request metadata (ipAddress, userAgent)
   * @returns {Promise<Object>} Created user and verification metadata
   */
  async signup(payload, context = {}) {
    const { email, password, firstName, lastName, role } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      // Record failed signup attempt in audit log
      await auditLogRepository.log({
        userId: existingUser._id,
        action: AuditAction.SIGNUP_FAILED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        status: 'FAILURE',
        details: { reason: 'Email already registered', email: normalizedEmail },
      });

      throw ApiError.conflict(
        'An account with this email address already exists.',
        ErrorCode.DUPLICATE_RESOURCE
      );
    }

    // 2. Hash user password with bcrypt
    const hashedPassword = await CryptoUtils.hashPassword(password, config.security.saltRounds);

    // 3. Persist User entity in PENDING_VERIFICATION status
    const newUser = await userRepository.create({
      email: normalizedEmail,
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: role || undefined,
      status: AccountStatus.PENDING_VERIFICATION,
      isEmailVerified: false,
      metadata: {
        signupIp: context.ipAddress,
        userAgent: context.userAgent,
        lastActiveAt: new Date(),
      },
    });

    // 4. Generate cryptographically secure verification token
    const rawVerificationToken = CryptoUtils.generateRandomToken(32);
    const tokenHash = CryptoUtils.hashToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + config.token.emailVerificationExpiryHours * 60 * 60 * 1000);

    await tokenRepository.create({
      userId: newUser._id,
      tokenHash,
      type: TokenType.EMAIL_VERIFICATION,
      expiresAt,
    });

    // 5. Dispatch verification email
    const emailResult = await emailService.sendVerificationEmail(
      newUser.email,
      newUser.firstName,
      rawVerificationToken
    );

    // 6. Record Audit Trail
    await auditLogRepository.log({
      userId: newUser._id,
      action: AuditAction.USER_SIGNUP,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      status: 'SUCCESS',
      details: { email: newUser.email, role: newUser.role },
    });

    logger.info(`User registered successfully: [${newUser._id}] ${newUser.email}`);

    return {
      user: newUser.toJSON(),
      verification: {
        sentTo: newUser.email,
        expiresInHours: config.token.emailVerificationExpiryHours,
        // In non-production, return raw token for ease of automated API testing & local verification
        ...(config.isProduction ? {} : { debugVerificationToken: rawVerificationToken }),
      },
    };
  }

  /**
   * Verify user email using the provided one-time token
   *
   * @param {string} rawToken - Unhashed token provided by user
   * @param {Object} context - Request metadata
   * @returns {Promise<Object>} Verified user object
   */
  async verifyEmail(rawToken, context = {}) {
    if (!rawToken) {
      throw ApiError.badRequest('Verification token is required.', ErrorCode.VALIDATION_ERROR);
    }

    // 1. Hash the incoming raw token to look up the DB record
    const tokenHash = CryptoUtils.hashToken(rawToken);
    const tokenDoc = await tokenRepository.findValidToken(tokenHash, TokenType.EMAIL_VERIFICATION);

    if (!tokenDoc) {
      throw ApiError.badRequest(
        'Invalid or expired verification token. Please request a new one.',
        ErrorCode.TOKEN_INVALID_OR_EXPIRED
      );
    }

    // 2. Fetch the associated user
    const user = await userRepository.findById(tokenDoc.userId);
    if (!user) {
      throw ApiError.notFound('Associated user account was not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (user.isEmailVerified && user.status === AccountStatus.ACTIVE) {
      // Invalidate the token just in case
      await tokenRepository.markAsUsed(tokenDoc._id);
      throw ApiError.badRequest(
        'This account email has already been verified.',
        ErrorCode.ACCOUNT_ALREADY_VERIFIED
      );
    }

    // 3. Update user status to ACTIVE
    const updatedUser = await userRepository.updateById(user._id, {
      status: AccountStatus.ACTIVE,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    // 4. Invalidate the token
    await tokenRepository.markAsUsed(tokenDoc._id);

    // 5. Record Audit Trail
    await auditLogRepository.log({
      userId: updatedUser._id,
      action: AuditAction.EMAIL_VERIFIED,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      status: 'SUCCESS',
      details: { email: updatedUser.email },
    });

    logger.info(`Email verified successfully for user: [${updatedUser._id}] ${updatedUser.email}`);

    return {
      user: updatedUser.toJSON(),
      message: 'Email verified successfully. Your account is now active.',
    };
  }

  /**
   * Resend verification email with cooldown rate-limit protection
   *
   * @param {string} email
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async resendVerificationEmail(email, context = {}) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Find user
    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      // Do not reveal email existence to prevent user enumeration attacks in production,
      // or return generic success message:
      return {
        message: 'If an account exists with that email, a new verification link has been sent.',
      };
    }

    if (user.isEmailVerified || user.status === AccountStatus.ACTIVE) {
      throw ApiError.badRequest(
        'This account has already been verified.',
        ErrorCode.ACCOUNT_ALREADY_VERIFIED
      );
    }

    // 2. Cooldown check: prevent spamming tokens within cooldown window
    const latestToken = await tokenRepository.findLatestTokenByUser(user._id, TokenType.EMAIL_VERIFICATION);
    if (latestToken) {
      const cooldownMs = config.token.resendCooldownMinutes * 60 * 1000;
      const timeSinceLastToken = Date.now() - new Date(latestToken.createdAt).getTime();

      if (timeSinceLastToken < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastToken) / 1000);
        throw ApiError.tooManyRequests(
          `Please wait ${remainingSeconds} seconds before requesting another verification email.`,
          ErrorCode.COOLDOWN_ACTIVE
        );
      }
    }

    // 3. Invalidate previous tokens
    await tokenRepository.invalidateAllUserTokens(user._id, TokenType.EMAIL_VERIFICATION);

    // 4. Generate new verification token
    const rawVerificationToken = CryptoUtils.generateRandomToken(32);
    const tokenHash = CryptoUtils.hashToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + config.token.emailVerificationExpiryHours * 60 * 60 * 1000);

    await tokenRepository.create({
      userId: user._id,
      tokenHash,
      type: TokenType.EMAIL_VERIFICATION,
      expiresAt,
    });

    // 5. Send verification email
    await emailService.sendVerificationEmail(user.email, user.firstName, rawVerificationToken);

    // 6. Record Audit Trail
    await auditLogRepository.log({
      userId: user._id,
      action: AuditAction.VERIFICATION_RESENT,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      status: 'SUCCESS',
      details: { email: user.email },
    });

    logger.info(`Verification email resent for user: [${user._id}] ${user.email}`);

    return {
      message: 'A new verification link has been dispatched to your email address.',
      ...(config.isProduction ? {} : { debugVerificationToken: rawVerificationToken }),
    };
  }

  /**
   * Authenticate a user by email and password
   *
   * @param {Object} credentials - User credentials { email, password }
   * @param {Object} context - Request metadata (ipAddress, userAgent)
   * @returns {Promise<Object>} Authenticated user profile
   */
  async login(credentials, context = {}) {
    const { email, password } = credentials;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Fetch user by email including password field
    const user = await userRepository.findByEmail(normalizedEmail, true);
    if (!user) {
      await auditLogRepository.log({
        userId: null,
        action: AuditAction.LOGIN_FAILED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        status: 'FAILURE',
        details: { reason: 'User not found', email: normalizedEmail },
      });

      throw ApiError.unauthorized('Invalid email or password.', ErrorCode.INVALID_CREDENTIALS);
    }

    // 2. Verify password with bcrypt
    const isPasswordValid = await CryptoUtils.comparePassword(password, user.password);
    if (!isPasswordValid) {
      await auditLogRepository.log({
        userId: user._id,
        action: AuditAction.LOGIN_FAILED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        status: 'FAILURE',
        details: { reason: 'Password mismatch', email: normalizedEmail },
      });

      throw ApiError.unauthorized('Invalid email or password.', ErrorCode.INVALID_CREDENTIALS);
    }

    // 3. Check account verification & lock state
    if (user.status === AccountStatus.PENDING_VERIFICATION || !user.isEmailVerified) {
      throw ApiError.forbidden(
        'Please verify your email address before logging in.',
        ErrorCode.ACCOUNT_NOT_VERIFIED
      );
    }

    if (
      user.status === AccountStatus.SUSPENDED ||
      user.status === AccountStatus.LOCKED ||
      user.status === AccountStatus.DEACTIVATED
    ) {
      throw ApiError.forbidden(
        `Your account is ${user.status.toLowerCase()}. Please contact support.`,
        ErrorCode.ACCOUNT_LOCKED
      );
    }

    // 4. Update last active metadata
    const updatedUser = await userRepository.updateById(user._id, {
      'metadata.lastActiveAt': new Date(),
    });

    // 5. Record successful login audit log
    await auditLogRepository.log({
      userId: user._id,
      action: AuditAction.USER_LOGIN,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      status: 'SUCCESS',
      details: { email: user.email },
    });

    logger.info(`User logged in successfully: [${user._id}] ${user.email}`);

    const safeUser = updatedUser && typeof updatedUser.toJSON === 'function' ? updatedUser.toJSON() : (typeof user.toJSON === 'function' ? user.toJSON() : user);

    return {
      user: safeUser,
      message: 'Login successful.',
    };
  }
}

module.exports = new AuthService();
