/**
 * middleware/rateLimiter.js — Rate Limiting
 *
 * Three different bouncers for different doors:
 *
 *   loginLimiter   → max 10 login attempts per 15 minutes per IP
 *                    (stops bots from hammering the login endpoint)
 *
 *   analysisLimiter → max 20 analysis calls per hour per IP
 *                    (stops anyone draining wallets or abusing Anthropic API)
 *
 *   generalLimiter  → max 100 requests per 15 minutes per IP
 *                    (general protection on all routes)
 */

const rateLimit = require("express-rate-limit");

// Friendly message helper
const message = (action, window) => ({
  error: `Too many ${action} attempts. Please wait ${window} and try again.`,
});

// ── Login limiter ─────────────────────────────────────────────────────────────
// Blocks bots trying to brute-force or spam account creation
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("login", "15 minutes"),
});

// ── Analysis limiter ──────────────────────────────────────────────────────────
// Each call costs 0.50 USDC — this protects against:
//   - someone scripting thousands of calls against another user's wallet
//   - runaway frontend bugs that loop requests
//   - Anthropic API bill spikes
const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,                   // 20 analyses per hour per IP is generous for real users
  standardHeaders: true,
  legacyHeaders: false,
  message: message("analysis", "1 hour"),
});

// ── General limiter ───────────────────────────────────────────────────────────
// Baseline protection on all routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: message("requests", "15 minutes"),
});

module.exports = { loginLimiter, analysisLimiter, generalLimiter };
