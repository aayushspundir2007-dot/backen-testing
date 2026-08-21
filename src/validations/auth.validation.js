const Joi = require('joi');
const { UserRole } = require('../constants/enums');

// Custom password complexity validator
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,64}$/;

const customPasswordMessages = {
  'string.pattern.base':
    'Password must be 8-64 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
  'string.min': 'Password must have at least 8 characters.',
  'string.max': 'Password cannot exceed 64 characters.',
  'any.required': 'Password is required.',
};

const signup = {
  body: Joi.object().keys({
    email: Joi.string().email().required().trim().lowercase().messages({
      'string.email': 'Please provide a valid email address.',
      'any.required': 'Email is required.',
    }),
    password: Joi.string().required().pattern(passwordPattern).messages(customPasswordMessages),
    firstName: Joi.string().trim().min(1).max(50).required().messages({
      'string.empty': 'First name cannot be empty.',
      'any.required': 'First name is required.',
    }),
    lastName: Joi.string().trim().min(1).max(50).required().messages({
      'string.empty': 'Last name cannot be empty.',
      'any.required': 'Last name is required.',
    }),
    role: Joi.string()
      .valid(...Object.values(UserRole))
      .optional()
      .default(UserRole.USER),
  }),
};

const verifyEmail = {
  query: Joi.object().keys({
    token: Joi.string().trim().required().messages({
      'string.empty': 'Verification token is required.',
      'any.required': 'Verification token is required.',
    }),
  }),
};

const resendVerification = {
  body: Joi.object().keys({
    email: Joi.string().email().required().trim().lowercase().messages({
      'string.email': 'Please provide a valid email address.',
      'any.required': 'Email is required.',
    }),
  }),
};

const login = {
  body: Joi.object().keys({
    email: Joi.string().email().required().trim().lowercase().messages({
      'string.email': 'Please provide a valid email address.',
      'any.required': 'Email is required.',
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password cannot be empty.',
      'any.required': 'Password is required.',
    }),
  }),
};

module.exports = {
  signup,
  verifyEmail,
  resendVerification,
  login,
};
