const { expect } = require('chai');
const sinon = require('sinon');

const emailService = require('../../../src/services/email.service');
const logger = require('../../../src/utils/logger');
const config = require('../../../src/config');

describe('EmailService Unit Tests - Email Dispatch Logic', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('sendVerificationEmail()', () => {
    it('should construct the correct verification URL and return success confirmation', async () => {
      const to = 'alexander.hamilton@treasury.gov';
      const firstName = 'Alexander';
      const rawToken = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';

      const loggerSpy = sandbox.spy(logger, 'info');

      const result = await emailService.sendVerificationEmail(to, firstName, rawToken);

      // 1. Return structure
      expect(result).to.be.an('object');
      expect(result).to.have.property('sent', true);
      expect(result).to.have.property('verificationUrl', `${config.clientUrl}/verify-email?token=${rawToken}`);
      expect(result).to.have.property('rawToken', rawToken);

      // 2. Logger invocation verification
      expect(loggerSpy.called).to.be.true;
      const logCalls = loggerSpy.getCalls().map((call) => call.args[0]);

      expect(logCalls.some((msg) => msg.includes(to))).to.be.true;
      expect(logCalls.some((msg) => msg.includes(firstName))).to.be.true;
      expect(logCalls.some((msg) => msg.includes(rawToken))).to.be.true;
      expect(logCalls.some((msg) => msg.includes(`${config.token.emailVerificationExpiryHours} hours`))).to.be.true;
    });

    it('should correctly format verification URL with different token lengths and values', async () => {
      const to = 'eliza.schuyler@example.com';
      const firstName = 'Eliza';
      const customToken = 'custom_test_token_999';

      sandbox.stub(logger, 'info');

      const result = await emailService.sendVerificationEmail(to, firstName, customToken);

      expect(result.sent).to.be.true;
      expect(result.verificationUrl).to.equal(`${config.clientUrl}/verify-email?token=${customToken}`);
      expect(result.rawToken).to.equal(customToken);
    });

    it('should handle recipient names with special characters and accents', async () => {
      const to = 'rene.descartes@philosophy.fr';
      const firstName = 'René-François';
      const token = 'token_with_accent_123';

      const loggerSpy = sandbox.spy(logger, 'info');

      const result = await emailService.sendVerificationEmail(to, firstName, token);

      expect(result.sent).to.be.true;
      expect(result.verificationUrl).to.include(token);

      const logCalls = loggerSpy.getCalls().map((call) => call.args[0]);
      expect(logCalls.some((msg) => msg.includes('René-François'))).to.be.true;
    });
  });
});
