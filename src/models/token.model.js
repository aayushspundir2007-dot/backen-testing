const mongoose = require('mongoose');
const { TokenType } = require('../constants/enums');

const tokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TokenType),
      default: TokenType.EMAIL_VERIFICATION,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically delete expired token documents from MongoDB
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for querying active tokens
tokenSchema.index({ userId: 1, type: 1, isUsed: 1 });

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
