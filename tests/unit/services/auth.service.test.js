const { expect } = require('chai');
const sinon = require('sinon');

const authService = require('../../../src/services/auth.service');
const userRepository = require('../../../src/repositories/user.repository');
const tokenRepository = require('../../../src/repositories/token.repository');
const auditLogRepository = require('../../../src/repositories/auditLog.repository');
const emailService = require('../../../src/services/email.service');
const CryptoUtils = require('../../../src/utils/crypto');
const ApiError = require('../../../src/utils/ApiError');
const { AccountStatus, UserRole, TokenType, AuditAction, ErrorCode, HttpStatus } = require('../../../src/constants/enums');

describe('AuthService Unit Tests - Registration & Verification Logic', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('signup()', () => {
    const validSignupPayload = {
      email: 'Jane.Doe@Enterprise.com',
      password: 'StrongPassword123!',
      firstName: 'Jane',
      lastName: 'Doe',
      role: UserRole.USER,
    };

    const mockContext = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 UnitTester',
    };

    it('should successfully register a new user, create verification token, log audit, and dispatch verification email', async () => {
      const normalizedEmail = 'jane.doe@enterprise.com';
      const fakeHashedPassword = '$2b$12$fakehashedpasswordstring';
      const fakeRawToken = 'a'.repeat(64);
      const fakeTokenHash = 'b'.repeat(64);

      const fakeCreatedUser = {
        _id: '507f1f77bcf86cd799439011',
        email: normalizedEmail,
        password: fakeHashedPassword,
        firstName: 'Jane',
        lastName: 'Doe',
        role: UserRole.USER,
        status: AccountStatus.PENDING_VERIFICATION,
        isEmailVerified: false,
        toJSON: () => ({
          id: '507f1f77bcf86cd799439011',
          email: normalizedEmail,
          firstName: 'Jane',
          lastName: 'Doe',
          role: UserRole.USER,
          status: AccountStatus.PENDING_VERIFICATION,
          isEmailVerified: false,
        }),
      };

      // Stubs
      sandbox.stub(userRepository, 'findByEmail').resolves(null);
      sandbox.stub(CryptoUtils, 'hashPassword').resolves(fakeHashedPassword);
      sandbox.stub(userRepository, 'create').resolves(fakeCreatedUser);
      sandbox.stub(CryptoUtils, 'generateRandomToken').returns(fakeRawToken);
      sandbox.stub(CryptoUtils, 'hashToken').returns(fakeTokenHash);
      sandbox.stub(tokenRepository, 'create').resolves({ _id: 'tokenId123' });
      sandbox.stub(emailService, 'sendVerificationEmail').resolves({ sent: true });
      sandbox.stub(auditLogRepository, 'log').resolves({ _id: 'auditId123' });

      const result = await authService.signup(validSignupPayload, mockContext);

      // Assertions: 1. Duplicate check with normalized email
      expect(userRepository.findByEmail.calledOnceWithExactly(normalizedEmail)).to.be.true;

      // 2. Password hashing called with correct password
      expect(CryptoUtils.hashPassword.calledOnce).to.be.true;
      expect(CryptoUtils.hashPassword.firstCall.args[0]).to.equal(validSignupPayload.password);

      // 3. User creation called with PENDING_VERIFICATION and normalized email
      expect(userRepository.create.calledOnce).to.be.true;
      const userCreateArg = userRepository.create.firstCall.args[0];
      expect(userCreateArg.email).to.equal(normalizedEmail);
      expect(userCreateArg.status).to.equal(AccountStatus.PENDING_VERIFICATION);
      expect(userCreateArg.isEmailVerified).to.be.false;
      expect(userCreateArg.password).to.equal(fakeHashedPassword);

      // 4. Token creation called with token hash and expiration
      expect(tokenRepository.create.calledOnce).to.be.true;
      const tokenCreateArg = tokenRepository.create.firstCall.args[0];
      expect(tokenCreateArg.userId).to.equal(fakeCreatedUser._id);
      expect(tokenCreateArg.tokenHash).to.equal(fakeTokenHash);
      expect(tokenCreateArg.type).to.equal(TokenType.EMAIL_VERIFICATION);
      expect(tokenCreateArg.expiresAt).to.be.instanceOf(Date);

      // 5. Verification email dispatched to user
      expect(emailService.sendVerificationEmail.calledOnceWithExactly(
        normalizedEmail,
        'Jane',
        fakeRawToken
      )).to.be.true;

      // 6. Audit log recorded with USER_SIGNUP
      expect(auditLogRepository.log.calledOnce).to.be.true;
      const auditLogArg = auditLogRepository.log.firstCall.args[0];
      expect(auditLogArg.action).to.equal(AuditAction.USER_SIGNUP);
      expect(auditLogArg.status).to.equal('SUCCESS');
      expect(auditLogArg.userId).to.equal(fakeCreatedUser._id);
      expect(auditLogArg.ipAddress).to.equal(mockContext.ipAddress);

      // 7. Result contains clean user data without password
      expect(result).to.have.property('user');
      expect(result.user.email).to.equal(normalizedEmail);
      expect(result.user).to.not.have.property('password');
      expect(result).to.have.property('verification');
      expect(result.verification.sentTo).to.equal(normalizedEmail);
    });

    it('should throw ApiError.conflict (409) and log SIGNUP_FAILED when email is already registered', async () => {
      const existingUser = {
        _id: '507f1f77bcf86cd799439099',
        email: 'jane.doe@enterprise.com',
      };

      sandbox.stub(userRepository, 'findByEmail').resolves(existingUser);
      sandbox.stub(auditLogRepository, 'log').resolves({});
      const createSpy = sandbox.spy(userRepository, 'create');
      const emailSpy = sandbox.spy(emailService, 'sendVerificationEmail');

      try {
        await authService.signup(validSignupPayload, mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.statusCode).to.equal(HttpStatus.CONFLICT);
        expect(err.errorCode).to.equal(ErrorCode.DUPLICATE_RESOURCE);
        expect(err.message).to.include('already exists');
      }

      // Assert audit log captured the failure
      expect(auditLogRepository.log.calledOnce).to.be.true;
      const auditLogArg = auditLogRepository.log.firstCall.args[0];
      expect(auditLogArg.action).to.equal(AuditAction.SIGNUP_FAILED);
      expect(auditLogArg.status).to.equal('FAILURE');
      expect(auditLogArg.userId).to.equal(existingUser._id);

      // Verify no user was created and no email was sent
      expect(createSpy.called).to.be.false;
      expect(emailSpy.called).to.be.false;
    });
  });

  describe('verifyEmail()', () => {
    const rawToken = 'sample_raw_token_hex_string_12345';
    const mockContext = { ipAddress: '10.0.0.1', userAgent: 'Mocha' };

    it('should throw ApiError.badRequest if token is missing', async () => {
      try {
        await authService.verifyEmail('', mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.statusCode).to.equal(HttpStatus.BAD_REQUEST);
      }
    });

    it('should throw ApiError.badRequest if token is invalid or expired', async () => {
      sandbox.stub(CryptoUtils, 'hashToken').returns('hashed_token');
      sandbox.stub(tokenRepository, 'findValidToken').resolves(null);

      try {
        await authService.verifyEmail(rawToken, mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.statusCode).to.equal(HttpStatus.BAD_REQUEST);
        expect(err.errorCode).to.equal(ErrorCode.TOKEN_INVALID_OR_EXPIRED);
      }
    });

    it('should successfully activate account and mark token as used for valid token', async () => {
      const mockTokenDoc = {
        _id: 'tokenId999',
        userId: 'userId999',
        type: TokenType.EMAIL_VERIFICATION,
        isUsed: false,
      };

      const mockPendingUser = {
        _id: 'userId999',
        email: 'test@example.com',
        status: AccountStatus.PENDING_VERIFICATION,
        isEmailVerified: false,
      };

      const mockActiveUser = {
        _id: 'userId999',
        email: 'test@example.com',
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        toJSON: () => ({
          id: 'userId999',
          email: 'test@example.com',
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
        }),
      };

      sandbox.stub(CryptoUtils, 'hashToken').returns('hashed_token');
      sandbox.stub(tokenRepository, 'findValidToken').resolves(mockTokenDoc);
      sandbox.stub(userRepository, 'findById').resolves(mockPendingUser);
      sandbox.stub(userRepository, 'updateById').resolves(mockActiveUser);
      sandbox.stub(tokenRepository, 'markAsUsed').resolves({});
      sandbox.stub(auditLogRepository, 'log').resolves({});

      const result = await authService.verifyEmail(rawToken, mockContext);

      expect(userRepository.updateById.calledOnce).to.be.true;
      const updateArgs = userRepository.updateById.firstCall.args;
      expect(updateArgs[0]).to.equal('userId999');
      expect(updateArgs[1].status).to.equal(AccountStatus.ACTIVE);
      expect(updateArgs[1].isEmailVerified).to.be.true;

      expect(tokenRepository.markAsUsed.calledOnceWithExactly(mockTokenDoc._id)).to.be.true;
      expect(auditLogRepository.log.calledOnce).to.be.true;
      expect(auditLogRepository.log.firstCall.args[0].action).to.equal(AuditAction.EMAIL_VERIFIED);

      expect(result.user.status).to.equal(AccountStatus.ACTIVE);
      expect(result.user.isEmailVerified).to.be.true;
    });

    it('should throw ApiError.badRequest if user is already verified', async () => {
      const mockTokenDoc = {
        _id: 'tokenId999',
        userId: 'userId999',
      };

      const mockAlreadyActiveUser = {
        _id: 'userId999',
        email: 'test@example.com',
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
      };

      sandbox.stub(CryptoUtils, 'hashToken').returns('hashed_token');
      sandbox.stub(tokenRepository, 'findValidToken').resolves(mockTokenDoc);
      sandbox.stub(userRepository, 'findById').resolves(mockAlreadyActiveUser);
      sandbox.stub(tokenRepository, 'markAsUsed').resolves({});

      try {
        await authService.verifyEmail(rawToken, mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.errorCode).to.equal(ErrorCode.ACCOUNT_ALREADY_VERIFIED);
        expect(tokenRepository.markAsUsed.calledOnce).to.be.true;
      }
    });
  });

  describe('resendVerificationEmail()', () => {
    const mockEmail = 'pending.user@enterprise.com';
    const mockContext = { ipAddress: '127.0.0.1', userAgent: 'Mocha' };

    it('should reject already verified users with ACCOUNT_ALREADY_VERIFIED', async () => {
      sandbox.stub(userRepository, 'findByEmail').resolves({
        _id: 'user123',
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
      });

      try {
        await authService.resendVerificationEmail(mockEmail, mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.errorCode).to.equal(ErrorCode.ACCOUNT_ALREADY_VERIFIED);
      }
    });

    it('should reject resend request if cooldown period has not elapsed (429)', async () => {
      sandbox.stub(userRepository, 'findByEmail').resolves({
        _id: 'user123',
        status: AccountStatus.PENDING_VERIFICATION,
        isEmailVerified: false,
      });

      // Token created 30 seconds ago (cooldown is 2 minutes)
      const recentToken = {
        createdAt: new Date(Date.now() - 30 * 1000),
      };
      sandbox.stub(tokenRepository, 'findLatestTokenByUser').resolves(recentToken);

      try {
        await authService.resendVerificationEmail(mockEmail, mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.statusCode).to.equal(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.errorCode).to.equal(ErrorCode.COOLDOWN_ACTIVE);
      }
    });

    it('should successfully resend verification email after cooldown has elapsed', async () => {
      const mockPendingUser = {
        _id: 'user123',
        email: mockEmail,
        firstName: 'Pending',
        status: AccountStatus.PENDING_VERIFICATION,
        isEmailVerified: false,
      };

      // Token created 5 minutes ago (well past 2-min cooldown)
      const oldToken = {
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      };

      sandbox.stub(userRepository, 'findByEmail').resolves(mockPendingUser);
      sandbox.stub(tokenRepository, 'findLatestTokenByUser').resolves(oldToken);
      sandbox.stub(tokenRepository, 'invalidateAllUserTokens').resolves({});
      sandbox.stub(CryptoUtils, 'generateRandomToken').returns('new_token_123');
      sandbox.stub(CryptoUtils, 'hashToken').returns('new_token_hash_123');
      sandbox.stub(tokenRepository, 'create').resolves({});
      sandbox.stub(emailService, 'sendVerificationEmail').resolves({ sent: true });
      sandbox.stub(auditLogRepository, 'log').resolves({});

      const result = await authService.resendVerificationEmail(mockEmail, mockContext);

      expect(tokenRepository.invalidateAllUserTokens.calledOnceWithExactly(
        mockPendingUser._id,
        TokenType.EMAIL_VERIFICATION
      )).to.be.true;

      expect(emailService.sendVerificationEmail.calledOnceWithExactly(
        mockEmail,
        'Pending',
        'new_token_123'
      )).to.be.true;

      expect(auditLogRepository.log.calledOnce).to.be.true;
      expect(auditLogRepository.log.firstCall.args[0].action).to.equal(AuditAction.VERIFICATION_RESENT);
      expect(result.message).to.include('dispatched');
    });
  });

  describe('login()', () => {
    const validCredentials = {
      email: 'alexander.hamilton@treasury.gov',
      password: 'CorrectPassword123!',
    };

    const mockContext = {
      ipAddress: '192.168.1.50',
      userAgent: 'Mozilla/5.0 Mocha',
    };

    it('should successfully authenticate an active user with valid credentials, update lastActiveAt, and log USER_LOGIN', async () => {
      const normalizedEmail = 'alexander.hamilton@treasury.gov';
      const mockUserFromDb = {
        _id: 'user_id_101',
        email: normalizedEmail,
        password: '$2b$12$hashedPasswordInDb',
        firstName: 'Alexander',
        lastName: 'Hamilton',
        role: UserRole.USER,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        toJSON: () => ({
          id: 'user_id_101',
          email: normalizedEmail,
          firstName: 'Alexander',
          lastName: 'Hamilton',
          role: UserRole.USER,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
        }),
      };

      sandbox.stub(userRepository, 'findByEmail').resolves(mockUserFromDb);
      sandbox.stub(CryptoUtils, 'comparePassword').resolves(true);
      sandbox.stub(userRepository, 'updateById').resolves(mockUserFromDb);
      sandbox.stub(auditLogRepository, 'log').resolves({});

      const result = await authService.login(validCredentials, mockContext);

      // 1. Looked up with password projection
      expect(userRepository.findByEmail.calledOnceWithExactly(normalizedEmail, true)).to.be.true;

      // 2. Verified password
      expect(CryptoUtils.comparePassword.calledOnceWithExactly(validCredentials.password, mockUserFromDb.password)).to.be.true;

      // 3. Updated lastActiveAt
      expect(userRepository.updateById.calledOnce).to.be.true;
      expect(userRepository.updateById.firstCall.args[0]).to.equal(mockUserFromDb._id);
      expect(userRepository.updateById.firstCall.args[1]).to.have.property('metadata.lastActiveAt');

      // 4. Recorded USER_LOGIN audit log
      expect(auditLogRepository.log.calledOnce).to.be.true;
      const auditArg = auditLogRepository.log.firstCall.args[0];
      expect(auditArg.action).to.equal(AuditAction.USER_LOGIN);
      expect(auditArg.status).to.equal('SUCCESS');
      expect(auditArg.userId).to.equal(mockUserFromDb._id);

      // 5. Returned safe user payload
      expect(result.user).to.have.property('id', 'user_id_101');
      expect(result.user).to.not.have.property('password');
      expect(result.message).to.equal('Login successful.');
    });

    it('should throw ApiError.unauthorized (401) and log LOGIN_FAILED if user is not found', async () => {
      sandbox.stub(userRepository, 'findByEmail').resolves(null);
      sandbox.stub(auditLogRepository, 'log').resolves({});
      const compareSpy = sandbox.spy(CryptoUtils, 'comparePassword');

      try {
        await authService.login(validCredentials, mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.statusCode).to.equal(HttpStatus.UNAUTHORIZED);
        expect(err.errorCode).to.equal(ErrorCode.INVALID_CREDENTIALS);
        expect(err.message).to.include('Invalid email or password');
      }

      expect(compareSpy.called).to.be.false;
      expect(auditLogRepository.log.calledOnce).to.be.true;
      const auditArg = auditLogRepository.log.firstCall.args[0];
      expect(auditArg.action).to.equal(AuditAction.LOGIN_FAILED);
      expect(auditArg.status).to.equal('FAILURE');
      expect(auditArg.userId).to.be.null;
    });

    it('should throw ApiError.unauthorized (401) and log LOGIN_FAILED if password does not match', async () => {
      const mockUserFromDb = {
        _id: 'user_id_102',
        email: 'alexander.hamilton@treasury.gov',
        password: '$2b$12$hashedPasswordInDb',
      };

      sandbox.stub(userRepository, 'findByEmail').resolves(mockUserFromDb);
      sandbox.stub(CryptoUtils, 'comparePassword').resolves(false);
      sandbox.stub(auditLogRepository, 'log').resolves({});

      try {
        await authService.login(validCredentials, mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.statusCode).to.equal(HttpStatus.UNAUTHORIZED);
        expect(err.errorCode).to.equal(ErrorCode.INVALID_CREDENTIALS);
      }

      expect(auditLogRepository.log.calledOnce).to.be.true;
      const auditArg = auditLogRepository.log.firstCall.args[0];
      expect(auditArg.action).to.equal(AuditAction.LOGIN_FAILED);
      expect(auditArg.userId).to.equal(mockUserFromDb._id);
    });

    it('should throw ApiError.forbidden (403) if account is PENDING_VERIFICATION or unverified', async () => {
      const mockUnverifiedUser = {
        _id: 'user_id_103',
        email: 'alexander.hamilton@treasury.gov',
        password: '$2b$12$hashedPasswordInDb',
        status: AccountStatus.PENDING_VERIFICATION,
        isEmailVerified: false,
      };

      sandbox.stub(userRepository, 'findByEmail').resolves(mockUnverifiedUser);
      sandbox.stub(CryptoUtils, 'comparePassword').resolves(true);

      try {
        await authService.login(validCredentials, mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.statusCode).to.equal(HttpStatus.FORBIDDEN);
        expect(err.errorCode).to.equal(ErrorCode.ACCOUNT_NOT_VERIFIED);
        expect(err.message).to.include('verify your email');
      }
    });

    it('should throw ApiError.forbidden (403) if account is LOCKED or SUSPENDED', async () => {
      const mockLockedUser = {
        _id: 'user_id_104',
        email: 'alexander.hamilton@treasury.gov',
        password: '$2b$12$hashedPasswordInDb',
        status: AccountStatus.LOCKED,
        isEmailVerified: true,
      };

      sandbox.stub(userRepository, 'findByEmail').resolves(mockLockedUser);
      sandbox.stub(CryptoUtils, 'comparePassword').resolves(true);

      try {
        await authService.login(validCredentials, mockContext);
        expect.fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.statusCode).to.equal(HttpStatus.FORBIDDEN);
        expect(err.errorCode).to.equal(ErrorCode.ACCOUNT_LOCKED);
        expect(err.message).to.include('locked');
      }
    });
  });
});
