const User = require('../models/user.model');

/**
 * Data Access Layer for User Entity
 */
class UserRepository {
  /**
   * Create a new user in MongoDB
   * @param {Object} userData
   * @param {Object} [session=null] - Optional mongoose ClientSession for transactions
   * @returns {Promise<User>}
   */
  async create(userData, session = null) {
    const options = session ? { session } : {};
    const [user] = await User.create([userData], options);
    return user;
  }

  /**
   * Find user by email (case-insensitive)
   * @param {string} email
   * @param {boolean} [includePassword=false]
   * @returns {Promise<User|null>}
   */
  async findByEmail(email, includePassword = false) {
    const query = User.findOne({ email: email.toLowerCase().trim() });
    if (includePassword) {
      query.select('+password');
    }
    return query.exec();
  }

  /**
   * Find user by ID
   * @param {string} id
   * @param {boolean} [includePassword=false]
   * @returns {Promise<User|null>}
   */
  async findById(id, includePassword = false) {
    const query = User.findById(id);
    if (includePassword) {
      query.select('+password');
    }
    return query.exec();
  }

  /**
   * Check if email already exists
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async existsByEmail(email) {
    const count = await User.countDocuments({ email: email.toLowerCase().trim() });
    return count > 0;
  }

  /**
   * Update user status and email verification fields
   * @param {string} userId
   * @param {Object} updateData
   * @param {Object} [session=null]
   * @returns {Promise<User|null>}
   */
  async updateById(userId, updateData, session = null) {
    const options = { new: true, runValidators: true };
    if (session) {
      options.session = session;
    }
    return User.findByIdAndUpdate(userId, updateData, options).exec();
  }
}

module.exports = new UserRepository();
