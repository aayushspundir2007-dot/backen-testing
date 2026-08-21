const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(5000),
  API_PREFIX: Joi.string().default('/api/v1'),
  MONGODB_URI: Joi.string().required().description('MongoDB connection string'),
  BCRYPT_SALT_ROUNDS: Joi.number().min(8).max(16).default(12),
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: Joi.number().positive().default(24),
  RESEND_VERIFICATION_COOLDOWN_MINUTES: Joi.number().positive().default(2),
  RATE_LIMIT_WINDOW_MS: Joi.number().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().positive().default(100),
  SIGNUP_RATE_LIMIT_WINDOW_MS: Joi.number().positive().default(15 * 60 * 1000),
  SIGNUP_RATE_LIMIT_MAX_REQUESTS: Joi.number().positive().default(10),
  CORS_ORIGIN: Joi.string().default('*'),
  CLIENT_URL: Joi.string().uri().default('http://localhost:3000'),
}).unknown();

const { value: envVars, error } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Configuration validation error: ${error.message}`);
}

const config = Object.freeze({
  env: envVars.NODE_ENV,
  isProduction: envVars.NODE_ENV === 'production',
  isDevelopment: envVars.NODE_ENV === 'development',
  isTest: envVars.NODE_ENV === 'test',
  port: envVars.PORT,
  apiPrefix: envVars.API_PREFIX,
  mongoose: {
    url: envVars.MONGODB_URI,
    options: {
      autoIndex: envVars.NODE_ENV !== 'production',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },
  security: {
    saltRounds: envVars.BCRYPT_SALT_ROUNDS,
  },
  token: {
    emailVerificationExpiryHours: envVars.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS,
    resendCooldownMinutes: envVars.RESEND_VERIFICATION_COOLDOWN_MINUTES,
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX_REQUESTS,
    signup: {
      windowMs: envVars.SIGNUP_RATE_LIMIT_WINDOW_MS,
      max: envVars.SIGNUP_RATE_LIMIT_MAX_REQUESTS,
    },
  },
  cors: {
    origin: envVars.CORS_ORIGIN,
  },
  clientUrl: envVars.CLIENT_URL,
});

module.exports = config;
