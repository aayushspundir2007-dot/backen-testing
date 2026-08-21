const { HttpStatus } = require('../constants/enums');

/**
 * Standardized API Response Wrapper
 */
class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human-readable success message
   * @param {any} [data=null] - Response payload
   * @param {Object} [meta={}] - Optional metadata (pagination, timestamp, requestId, etc.)
   */
  constructor(statusCode = HttpStatus.OK, message = 'Success', data = null, meta = {}) {
    this.success = statusCode >= 200 && statusCode < 300;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.meta = {
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }

  static success(message = 'Success', data = null, meta = {}) {
    return new ApiResponse(HttpStatus.OK, message, data, meta);
  }

  static created(message = 'Resource created successfully', data = null, meta = {}) {
    return new ApiResponse(HttpStatus.CREATED, message, data, meta);
  }

  static accepted(message = 'Request accepted for processing', data = null, meta = {}) {
    return new ApiResponse(HttpStatus.ACCEPTED, message, data, meta);
  }
}

module.exports = ApiResponse;
