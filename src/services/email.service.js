const logger = require('../utils/logger');
const config = require('../config');

/**
 * Enterprise Email Notification Service
 * Pluggable provider pattern: currently logs formatted templates for dev/testing,
 * with clean hooks to plug in Nodemailer, SendGrid, Amazon SES, or Mailgun.
 */
class EmailService {
  /**
   * Send Email Verification Link
   * @param {string} to - Recipient email address
   * @param {string} firstName - Recipient first name
   * @param {string} rawToken - Unhashed verification token
   * @returns {Promise<{ sent: boolean, verificationUrl: string }>}
   */
  async sendVerificationEmail(to, firstName, rawToken) {
    const verificationUrl = `${config.clientUrl}/verify-email?token=${rawToken}`;

    logger.info(`[EmailService] Dispatching verification email to: ${to}`);
    logger.info(`--------------------------------------------------`);
    logger.info(`[Email Content Preview]`);
    logger.info(`To: ${to}`);
    logger.info(`Subject: Please verify your enterprise account`);
    logger.info(`Hello ${firstName},`);
    logger.info(`Thank you for registering. Please activate your account using the link below:`);
    logger.info(`Verification URL: ${verificationUrl}`);
    logger.info(`Token: ${rawToken}`);
    logger.info(`Expires in: ${config.token.emailVerificationExpiryHours} hours`);
    logger.info(`--------------------------------------------------`);

    // In a production environment with SMTP/SES/SendGrid configured:
    // await this.transporter.sendMail({ ... });

    return {
      sent: true,
      verificationUrl,
      rawToken, // Provided in development for easy integration and testability
    };
  }
}

module.exports = new EmailService();
