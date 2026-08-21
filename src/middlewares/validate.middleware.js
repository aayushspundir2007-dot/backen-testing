const Joi = require('joi');
const ApiError = require('../utils/ApiError');
const { ErrorCode } = require('../constants/enums');

/**
 * Middleware factory for Joi schema validation
 * @param {Object} schema - Object containing body, query, and/or params Joi schemas
 * @returns {Function} Express middleware function
 */
const validate = (schema) => (req, res, next) => {
  const validSchema = {};
  const objectToValidate = {};

  ['params', 'query', 'body'].forEach((key) => {
    if (schema[key]) {
      validSchema[key] = schema[key];
      objectToValidate[key] = req[key];
    }
  });

  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: 'key' }, abortEarly: false })
    .validate(objectToValidate);

  if (error) {
    const errorDetails = error.details.map((details) => ({
      field: details.path.join('.'),
      message: details.message.replace(/['"]/g, ''),
    }));

    return next(
      ApiError.badRequest(
        'Request validation failed',
        ErrorCode.VALIDATION_ERROR,
        errorDetails
      )
    );
  }

  // Assign validated and sanitized values back to request
  Object.assign(req, value);
  return next();
};

module.exports = validate;
