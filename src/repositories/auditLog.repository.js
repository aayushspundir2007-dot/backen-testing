const AuditLog = require('../models/auditLog.model');

/**
 * Data Access Layer for Audit Logs
 */
class AuditLogRepository {
  /**
   * Log an audit event
   * @param {Object} logData
   * @param {Object} [session=null]
   * @returns {Promise<AuditLog>}
   */
  async log(logData, session = null) {
    const options = session ? { session } : {};
    const [entry] = await AuditLog.create([logData], options);
    return entry;
  }
}

module.exports = new AuditLogRepository();
