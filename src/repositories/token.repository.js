const Token = require('../models/token.model');
const { TokenType } = require('../constants/enums');

/**
 * Data Access Layer for Token Entity
 */
class TokenRepository {
  /**
   * Create a verification/reset token
   * @param {Object} tokenData
   * @param {Object} [session=null]
   * @returns {Promise<Token>}
   */
  async create(tokenData, session = null) {
    const options = session ? { session } : {};
    const [token] = await Token.create([tokenData], options);
    return token;
  }

  /**
   * Find a valid, unexpired and unused token by hash and type
   * @param {string} tokenHash
   * @param {string} type
   * @returns {Promise<Token|null>}
   */
  async findValidToken(tokenHash, type = TokenType.EMAIL_VERIFICATION) {
    return Token.findOne({
      tokenHash,
      type,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).exec();
  }

  /**
   * Find most recent token generated for a user and type (for cooldown checking)
   * @param {string} userId
   * @param {string} type
   * @returns {Promise<Token|null>}
   */
  async findLatestTokenByUser(userId, type = TokenType.EMAIL_VERIFICATION) {
    return Token.findOne({ userId, type }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Invalidate/mark a token as used
   * @param {string} tokenId
   * @param {Object} [session=null]
   * @returns {Promise<Token|null>}
   */
  async markAsUsed(tokenId, session = null) {
    const options = { new: true };
    if (session) {
      options.session = session;
    }
    return Token.findByIdAndUpdate(
      tokenId,
      { isUsed: true, usedAt: new Date() },
      options
    ).exec();
  }

  /**
   * Invalidate all existing tokens of a specific type for a user
   * @param {string} userId
   * @param {string} type
   * @param {Object} [session=null]
   * @returns {Promise<any>}
   */
  async invalidateAllUserTokens(userId, type, session = null) {
    const options = session ? { session } : {};
    return Token.updateMany(
      { userId, type, isUsed: false },
      { isUsed: true, usedAt: new Date() },
      options
    ).exec();
  }
}

module.exports = new TokenRepository();
