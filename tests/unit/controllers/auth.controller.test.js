const { expect } = require('chai');
const sinon = require('sinon');

const authController = require('../../../src/controllers/auth.controller');
const authService = require('../../../src/services/auth.service');
const { HttpStatus } = require('../../../src/constants/enums');

describe('AuthController Unit Tests - Registration Route Handler Logic', () => {
  let sandbox;
  let req;
  let res;
  let next;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      query: {},
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Mocha-Test-Agent',
      },
    };

    res = {
      statusCode: null,
      jsonData: null,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.jsonData = data;
        return this;
      },
    };

    next = sandbox.spy();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('signup handler', () => {
    it('should invoke authService.signup and return 201 Created with standard ApiResponse envelope', async () => {
      req.body = {
        email: 'john.doe@company.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockServiceResult = {
        user: { id: 'u1', email: 'john.doe@company.com', firstName: 'John' },
        verification: { sentTo: 'john.doe@company.com' },
      };

      sandbox.stub(authService, 'signup').resolves(mockServiceResult);

      await authController.signup(req, res, next);

      expect(authService.signup.calledOnce).to.be.true;
      const [payloadArg, contextArg] = authService.signup.firstCall.args;
      expect(payloadArg).to.deep.equal(req.body);
      expect(contextArg.ipAddress).to.equal('127.0.0.1');
      expect(contextArg.userAgent).to.equal('Mocha-Test-Agent');

      expect(res.statusCode).to.equal(HttpStatus.CREATED);
      expect(res.jsonData.success).to.be.true;
      expect(res.jsonData.data).to.deep.equal(mockServiceResult);
      expect(res.jsonData.message).to.include('User registered successfully');
      expect(next.called).to.be.false;
    });

    it('should pass service errors down to next() middleware via asyncHandler', async () => {
      const error = new Error('Database down');
      sandbox.stub(authService, 'signup').rejects(error);

      await authController.signup(req, res, next);

      expect(next.calledOnceWithExactly(error)).to.be.true;
    });
  });

  describe('verifyEmail handler', () => {
    it('should invoke authService.verifyEmail with token and return 200 OK', async () => {
      req.query.token = 'mock_token_abc';

      const mockResult = {
        user: { id: 'u1', status: 'ACTIVE', isEmailVerified: true },
        message: 'Email verified successfully. Your account is now active.',
      };

      sandbox.stub(authService, 'verifyEmail').resolves(mockResult);

      await authController.verifyEmail(req, res, next);

      expect(authService.verifyEmail.calledOnceWithExactly('mock_token_abc', sinon.match.has('ipAddress', '127.0.0.1'))).to.be.true;
      expect(res.statusCode).to.equal(HttpStatus.OK);
      expect(res.jsonData.success).to.be.true;
      expect(res.jsonData.data.user.status).to.equal('ACTIVE');
      expect(next.called).to.be.false;
    });
  });

  describe('resendVerificationEmail handler', () => {
    it('should invoke authService.resendVerificationEmail with email and return 200 OK', async () => {
      req.body.email = 'pending@example.com';

      const mockResult = {
        message: 'A new verification link has been dispatched to your email address.',
      };

      sandbox.stub(authService, 'resendVerificationEmail').resolves(mockResult);

      await authController.resendVerificationEmail(req, res, next);

      expect(authService.resendVerificationEmail.calledOnceWithExactly('pending@example.com', sinon.match.has('ipAddress', '127.0.0.1'))).to.be.true;
      expect(res.statusCode).to.equal(HttpStatus.OK);
      expect(res.jsonData.success).to.be.true;
      expect(next.called).to.be.false;
    });
  });

  describe('login handler', () => {
    it('should invoke authService.login and return 200 OK with standard ApiResponse envelope', async () => {
      req.body = {
        email: 'alexander@example.com',
        password: 'Password123!',
      };

      const mockServiceResult = {
        user: { id: 'u1', email: 'alexander@example.com', role: 'USER' },
        message: 'Login successful.',
      };

      sandbox.stub(authService, 'login').resolves(mockServiceResult);

      await authController.login(req, res, next);

      expect(authService.login.calledOnce).to.be.true;
      const [credentialsArg, contextArg] = authService.login.firstCall.args;
      expect(credentialsArg).to.deep.equal(req.body);
      expect(contextArg.ipAddress).to.equal('127.0.0.1');

      expect(res.statusCode).to.equal(HttpStatus.OK);
      expect(res.jsonData.success).to.be.true;
      expect(res.jsonData.data).to.deep.equal(mockServiceResult);
      expect(res.jsonData.message).to.equal('Login successful.');
      expect(next.called).to.be.false;
    });

    it('should pass authentication errors down to next() middleware', async () => {
      const authError = new Error('Invalid credentials');
      sandbox.stub(authService, 'login').rejects(authError);

      await authController.login(req, res, next);

      expect(next.calledOnceWithExactly(authError)).to.be.true;
    });
  });
});
