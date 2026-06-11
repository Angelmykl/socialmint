/**
 * middleware/rateLimiter.js — Rate Limiting
 *
 *   loginLimiter      → max 10 login attempts per 15 minutes per IP
 *   analysisLimiter   → max 20 analysis calls per hour per IP
 *   generalLimiter    → max 500 requests per 15 minutes per IP
 *   predictionLimiter → max 1000 requests per 15 minutes per IP
 *                       (high limit because frontend polls every 10s)
 */

const rateLimit = require("express-rate-limit");

const message = (action, window) => ({
  error: `Too many ${action} attempts. Please wait ${window} and try again.`,
});

// ── Login limiter ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("login", "15 minutes"),
});

// ── Analysis limiter ──────────────────────────────────────────────────────────
const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("analysis", "1 hour"),
});

// ── General limiter ───────────────────────────────────────────────────────────
// Increased from 100 to 500 — prediction polling uses ~90 per 15min alone
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("requests", "15 minutes"),
});

// ── Prediction limiter ────────────────────────────────────────────────────────
// High limit — frontend polls conditions/history/prices every 10s
// 10s interval = 6 req/min = 90 req/15min just for polling
// Multiple endpoints × multiple users = needs high ceiling
const predictionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("prediction", "15 minutes"),
});

module.exports = { loginLimiter, analysisLimiter, generalLimiter, predictionLimiter };