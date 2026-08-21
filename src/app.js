const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes/v1');
const { globalRateLimiter } = require('./middlewares/rateLimiter.middleware');
const requestLogger = require('./middlewares/requestLogger.middleware');
const { errorConverter, errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// 1. Trust proxy if behind a reverse proxy (e.g., NGINX, Cloudflare, AWS ALB)
app.set('trust proxy', 1);

// 2. Set enterprise security HTTP headers
app.use(helmet());

// 3. Enable CORS with configurable options
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// 4. Parse JSON and urlencoded request bodies with size limits
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// 5. Global API rate limiting
app.use(globalRateLimiter);

// 6. Request timing and logging
app.use(requestLogger);

// 7. Mount versioned API routes
app.use(config.apiPrefix, routes);

// 8. Handle 404 for unknown routes
app.use(notFoundHandler);

// 9. Centralized Error Handling Pipeline
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
