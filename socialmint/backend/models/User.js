/**
 * models/User.js — User database model
 *
 * This replaces the in-memory Map() from before.
 * MongoDB stores every user permanently — survives restarts, crashes, deployments.
 *
 * Every user record holds:
 *   - their login info (name, provider)
 *   - their Circle wallet details (id + address)
 *   - their transaction history
 */

const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  txId:      { type: String, required: true },   // Circle transfer ID
  amount:    { type: Number, required: true },   // 0.50
  platform:  { type: String },                   // Instagram, TikTok etc
  status:    { type: String, default: "pending" }, // pending | confirmed | failed
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  // Login identity
  userId:   { type: String, required: true, unique: true }, // e.g. "google_12345"
  name:     { type: String, required: true },
  email:    { type: String },
  provider: { type: String, required: true }, // "google" | "twitter" | "wallet"

  // Circle wallet (auto-created on first login, never changes)
  circleWalletId:      { type: String, required: true },
  circleWalletAddress: { type: String, required: true },

  // Usage tracking
  totalAnalyses:  { type: Number, default: 0 },
  totalSpentUsdc: { type: Number, default: 0 },
  transactions:   [TransactionSchema],

  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
