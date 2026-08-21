const logger = require('../utils/logger');

/**
 * Enterprise Request Logging Middleware
 */
const requestLogger = (req, res, next) => {
  const startTime = process.hrtime();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
    const { statusCode } = res;

    const logMessage = `${method} ${originalUrl} ${statusCode} - ${durationMs}ms [IP: ${ip}]`;

    if (statusCode >= 500) {
      logger.error(logMessage);
    } else if (statusCode >= 400) {
      logger.warn(logMessage);
    } else {
      logger.info(logMessage);
    }
  });

  next();
};

module.exports = requestLogger;
