const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Enterprise Cryptographic and Password Utilities
 */
class CryptoUtils {
  /**
   * Hash password with bcrypt and configurable salt rounds
   * @param {string} password
   * @param {number} saltRounds
   * @returns {Promise<string>}
   */
  static async hashPassword(password, saltRounds = 12) {
    const salt = await bcrypt.genSalt(Number(saltRounds));
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare plain password with bcrypt hash
   * @param {string} password
   * @param {string} hashedPassword
   * @returns {Promise<boolean>}
   */
  static async comparePassword(password, hashedPassword) {
    if (!password || !hashedPassword) return false;
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate a cryptographically secure random token (hex)
   * @param {number} [bytes=32]
   * @returns {string}
   */
  static generateRandomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Hash a raw token with SHA-256 for secure database storage
   * @param {string} token
   * @returns {string}
   */
  static hashToken(token) {
    if (!token) return '';
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

module.exports = CryptoUtils;
