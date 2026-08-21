const express = require('express');
const authRoutes = require('./auth.routes');
const ApiResponse = require('../../utils/ApiResponse');

const router = express.Router();

/**
 * Health check endpoint
 * GET /api/v1/health
 */
router.get('/health', (req, res) => {
  res.json(
    ApiResponse.success('System is healthy and operational', {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'enterprise-auth-api',
      environment: process.env.NODE_ENV,
    })
  );
});

// Mount modular sub-routes
router.use('/auth', authRoutes);

module.exports = router;
