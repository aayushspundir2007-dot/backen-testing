const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB with enterprise connection management
 */
const connectDatabase = async () => {
  try {
    mongoose.connection.on('connecting', () => {
      logger.info('Connecting to MongoDB...');
    });

    mongoose.connection.on('connected', () => {
      logger.info('Successfully established connection with MongoDB.');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting reconnection if server is active...');
    });

    await mongoose.connect(config.mongoose.url, config.mongoose.options);
  } catch (error) {
    logger.error('Initial MongoDB connection failed:', error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB gracefully
 */
const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close(false);
    logger.info('MongoDB connection closed successfully.');
  } catch (error) {
    logger.error('Error while closing MongoDB connection:', error);
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
