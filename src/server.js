const app = require('./app');
const config = require('./config');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const logger = require('./utils/logger');

let server;

/**
 * Bootstrap application server
 */
const startServer = async () => {
  try {
    // 1. Connect to MongoDB database
    await connectDatabase();

    // 2. Start HTTP server
    server = app.listen(config.port, () => {
      logger.info(`==================================================`);
      logger.info(`🚀 Server running in [${config.env.toUpperCase()}] mode`);
      logger.info(`📡 Listening on http://localhost:${config.port}${config.apiPrefix}`);
      logger.info(`🏥 Health check: http://localhost:${config.port}${config.apiPrefix}/health`);
      logger.info(`==================================================`);
    });
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

/**
 * Graceful termination handler
 */
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDatabase();
      logger.info('Process terminated gracefully.');
      process.exit(0);
    });

    // Force close if graceful shutdown takes too long (10s timeout)
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Process-level event listeners for unhandled rejections and exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', err);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// OS Signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
