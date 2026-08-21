# Enterprise Signup Authentication API

A production-grade, enterprise-ready user registration and email verification backend built with **Node.js**, **Express**, and **MongoDB** (Mongoose) following a **Layered Monolithic Architecture**.

---

## 🏛️ Architecture & Folder Structure

```
backend testing/
├── src/
│   ├── config/             # Environment validation (Joi) & MongoDB connection
│   │   ├── database.js     # Connection pool & lifecycle event hooks
│   │   └── index.js        # Validated configuration exports
│   ├── constants/          # Application enums (AccountStatus, UserRole, ErrorCode, etc.)
│   │   └── enums.js
│   ├── controllers/        # Request handling and orchestrating responses
│   │   └── auth.controller.js
│   ├── middlewares/        # Express middlewares
│   │   ├── error.middleware.js       # Centralized error handler & Mongoose converters
│   │   ├── rateLimiter.middleware.js # Global & Auth specific rate limiters
│   │   ├── requestLogger.middleware.js # HTTP latency & request logger
│   │   └── validate.middleware.js    # Joi schema validation middleware
│   ├── models/             # Mongoose schemas with transforms and TTL indexes
│   │   ├── auditLog.model.js
│   │   ├── token.model.js
│   │   └── user.model.js
│   ├── repositories/       # Data Access Layer (DAL) abstraction
│   │   ├── auditLog.repository.js
│   │   ├── token.repository.js
│   │   └── user.repository.js
│   ├── routes/             # Versioned routing layer
│   │   └── v1/
│   │       ├── auth.routes.js
│   │       └── index.js
│   ├── services/           # Core enterprise business logic
│   │   ├── auth.service.js
│   │   └── email.service.js
│   ├── utils/              # Utility helpers
│   │   ├── ApiError.js     # Standardized operational error class
│   │   ├── ApiResponse.js  # Standardized API response envelope
│   │   ├── asyncHandler.js # Async route wrapper
│   │   ├── crypto.js       # Bcrypt password hashing & crypto token generators
│   │   └── logger.js       # Structured Winston logger
│   ├── app.js              # Express application assembly
│   └── server.js           # Server startup and graceful termination
├── scripts/
│   └── test-apis.js        # Automated API integration test suite
├── .env.example
├── .env
└── package.json
```

---

## 🛡️ Enterprise Features & Security

1. **Layered Monolith**: Strict isolation of concerns (`Controller` -> `Service` -> `Repository` -> `Model`).
2. **Password Security**: Bcrypt with configurable salt rounds (default: `12`).
3. **Sensitive Data Protection**: Mongoose `toJSON` transforms remove password hashes and internal version keys (`__v`).
4. **Token Security**: Raw tokens sent to users are never saved directly in the database. Instead, only SHA-256 hashes of the tokens are persisted in MongoDB with automatic **TTL (Time-To-Live) index expiration**.
5. **Rate Limiting**:
   - Stricter rate limits on authentication routes (`POST /auth/signup`, `POST /auth/resend-verification`) to mitigate spam / brute-force bots.
   - Per-account cooldown window (default: 2 minutes) on resending verification emails.
6. **Input Validation**: Robust Joi validation schemas ensuring RFC email format, password complexity rules, and input sanitization.
7. **Compliance & Audit Logging**: Append-only `AuditLog` collection tracking all registration and verification events with client IP addresses, user agents, and status.
8. **Observability**: Structured Winston logging with millisecond request latency profiling.
9. **Graceful Shutdown**: Handles `SIGTERM`, `SIGINT`, unhandled rejections, closing connection pools cleanly.

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [MongoDB](https://www.mongodb.com/) (running locally on port 27017 or a MongoDB Atlas URI)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and adjust if needed:
```bash
cp .env.example .env
```

### 4. Run the Server
```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

---

## 📡 API Endpoints Reference

### Base URL: `/api/v1`

| Method | Endpoint | Description | Rate Limited |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health status | Standard |
| `POST` | `/auth/signup` | Register a new user | Yes (Stricter) |
| `GET` | `/auth/verify-email?token={token}` | Verify user email & activate account | Standard |
| `POST` | `/auth/resend-verification` | Resend verification email | Yes + Cooldown |

---

### Request & Response Examples

#### 1. User Signup
`POST /api/v1/auth/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully. Please verify your email address to activate your account.",
  "data": {
    "user": {
      "id": "67323abc89f1...",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "status": "PENDING_VERIFICATION",
      "isEmailVerified": false,
      "emailVerifiedAt": null,
      "metadata": {
        "signupIp": "127.0.0.1",
        "userAgent": "PostmanRuntime/7.39.0",
        "lastActiveAt": "2026-08-21T10:30:00.000Z"
      },
      "createdAt": "2026-08-21T10:30:00.000Z",
      "updatedAt": "2026-08-21T10:30:00.000Z"
    },
    "verification": {
      "sentTo": "user@example.com",
      "expiresInHours": 24
    }
  },
  "meta": {
    "timestamp": "2026-08-21T10:30:00.000Z"
  }
}
```

---

#### 2. Email Verification
`GET /api/v1/auth/verify-email?token=8a29b4e...`

**Response (`200 OK`):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully. Your account is now active.",
  "data": {
    "user": {
      "id": "67323abc89f1...",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "status": "ACTIVE",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-08-21T10:32:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2026-08-21T10:32:00.000Z"
  }
}
```

---

#### 3. Resend Verification Email
`POST /api/v1/auth/resend-verification`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "A new verification link has been dispatched to your email address.",
  "meta": {
    "timestamp": "2026-08-21T10:35:00.000Z"
  }
}
```

---

## 🧪 Running Automated API Tests

Make sure the server and MongoDB are running, then run:
```bash
npm test
```
