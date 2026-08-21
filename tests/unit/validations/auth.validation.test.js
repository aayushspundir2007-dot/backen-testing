const { expect } = require('chai');
const authValidation = require('../../../src/validations/auth.validation');
const { UserRole } = require('../../../src/constants/enums');

describe('AuthValidation Unit Tests - Joi Schema Logic', () => {
  describe('signup validation schema', () => {
    it('should validate successfully when all fields meet enterprise criteria', () => {
      const validPayload = {
        email: 'alexander@example.com',
        password: 'ValidPassword123!',
        firstName: 'Alexander',
        lastName: 'Hamilton',
        role: UserRole.ENTERPRISE_MANAGER,
      };

      const { error, value } = authValidation.signup.body.validate(validPayload);
      expect(error).to.be.undefined;
      expect(value.email).to.equal('alexander@example.com');
    });

    it('should reject invalid password without numbers', () => {
      const payload = {
        email: 'alexander@example.com',
        password: 'NoNumbersPassword!',
        firstName: 'Alexander',
        lastName: 'Hamilton',
      };

      const { error } = authValidation.signup.body.validate(payload);
      expect(error).to.not.be.undefined;
      expect(error.details[0].message).to.include('Password must be 8-64 characters long');
    });

    it('should reject invalid password without special characters', () => {
      const payload = {
        email: 'alexander@example.com',
        password: 'NoSpecialChars123',
        firstName: 'Alexander',
        lastName: 'Hamilton',
      };

      const { error } = authValidation.signup.body.validate(payload);
      expect(error).to.not.be.undefined;
    });

    it('should reject malformed email strings', () => {
      const payload = {
        email: 'plainaddress',
        password: 'ValidPassword123!',
        firstName: 'Alexander',
        lastName: 'Hamilton',
      };

      const { error } = authValidation.signup.body.validate(payload);
      expect(error).to.not.be.undefined;
      expect(error.details[0].message).to.include('valid email');
    });

    it('should assign default UserRole.USER if role is omitted', () => {
      const payload = {
        email: 'alexander@example.com',
        password: 'ValidPassword123!',
        firstName: 'Alexander',
        lastName: 'Hamilton',
      };

      const { error, value } = authValidation.signup.body.validate(payload);
      expect(error).to.be.undefined;
      expect(value.role).to.equal(UserRole.USER);
    });
  });

  describe('verifyEmail validation schema', () => {
    it('should validate query token correctly', () => {
      const validQuery = { token: 'sample_token_12345' };
      const { error } = authValidation.verifyEmail.query.validate(validQuery);
      expect(error).to.be.undefined;
    });

    it('should reject missing query token', () => {
      const emptyQuery = {};
      const { error } = authValidation.verifyEmail.query.validate(emptyQuery);
      expect(error).to.not.be.undefined;
    });
  });

  describe('resendVerification validation schema', () => {
    it('should validate email format and normalize', () => {
      const validBody = { email: '  Test.User@Acme.com  ' };
      const { error, value } = authValidation.resendVerification.body.validate(validBody);
      expect(error).to.be.undefined;
      expect(value.email).to.equal('test.user@acme.com');
    });

    it('should reject missing email', () => {
      const emptyBody = {};
      const { error } = authValidation.resendVerification.body.validate(emptyBody);
      expect(error).to.not.be.undefined;
    });
  });

  describe('login validation schema', () => {
    it('should validate valid email and password payload', () => {
      const validBody = {
        email: '  User@Example.COM ',
        password: 'Password123!',
      };
      const { error, value } = authValidation.login.body.validate(validBody);
      expect(error).to.be.undefined;
      expect(value.email).to.equal('user@example.com');
      expect(value.password).to.equal('Password123!');
    });

    it('should reject missing password', () => {
      const invalidBody = {
        email: 'user@example.com',
      };
      const { error } = authValidation.login.body.validate(invalidBody);
      expect(error).to.not.be.undefined;
      expect(error.details[0].message).to.include('Password is required');
    });

    it('should reject empty password string', () => {
      const invalidBody = {
        email: 'user@example.com',
        password: '',
      };
      const { error } = authValidation.login.body.validate(invalidBody);
      expect(error).to.not.be.undefined;
      expect(error.details[0].message).to.include('Password cannot be empty');
    });

    it('should reject missing email', () => {
      const invalidBody = {
        password: 'Password123!',
      };
      const { error } = authValidation.login.body.validate(invalidBody);
      expect(error).to.not.be.undefined;
      expect(error.details[0].message).to.include('Email is required');
    });
  });
});
