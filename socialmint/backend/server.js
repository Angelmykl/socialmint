/**
 * server.js — SocialMint Backend
 *
 * Smart storage: uses MongoDB when MONGODB_URI is set (production/Railway)
 * Falls back to local db.json when no MongoDB (local development)
 *
 * This means:
 *   - Railway (live) → MongoDB → wallets/data saved forever
 *   - Your laptop    → db.json → works without internet/DNS issues
 */

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const jwt      = require("jsonwebtoken");
const axios    = require("axios");
const fs       = require("fs");
const path     = require("path");

const { loginLimiter, analysisLimiter, generalLimiter } = require("./middleware/rateLimiter");
const requireAuth = require("./middleware/auth");
const {
  createUserWallet, getWalletBalance,
  chargeUser, fundTestWallet,
} = require("./circle");

const app = express();
app.set("trust proxy", 1);

// ── Smart Database Layer ──────────────────────────────────────────────────────
// Automatically picks MongoDB or local file depending on environment

let useMongoose = false;
let UserModel   = null;

async function initDB() {
  if (process.env.MONGODB_URI) {
    try {
      const mongoose = require("mongoose");
      await mongoose.connect(process.env.MONGODB_URI);

      const UserSchema = new mongoose.Schema({
        userId:              { type: String, required: true, unique: true },
        name:                String,
        email:               String,
        provider:            String,
        circleWalletId:      String,
        circleWalletAddress: String,
        totalAnalyses:       { type: Number, default: 0 },
        totalSpentUsdc:      { type: Number, default: 0 },
        transactions:        { type: Array,  default: [] },
        analyses:            { type: Array,  default: [] },
        createdAt:           { type: Date,   default: Date.now },
        lastLoginAt:         { type: Date,   default: Date.now },
      }, { strict: false });

      UserModel   = mongoose.models.User || mongoose.model("User", UserSchema);
      useMongoose = true;
      console.log("✅ MongoDB connected — using cloud database");
    } catch (err) {
      console.log("⚠️  MongoDB failed, falling back to local db.json:", err.message);
    }
  } else {
    console.log("✅ Using local file database (db.json)");
  }
}

// ── File DB helpers (local fallback) ─────────────────────────────────────────
const DB_FILE = path.join(__dirname, "db.json");
function readDB()  { if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2)); return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
function writeDB(d){ fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); }

// ── Unified DB functions ──────────────────────────────────────────────────────
async function getUser(userId) {
  if (useMongoose) {
    const u = await UserModel.findOne({ userId }).lean();
    return u || null;
  }
  return readDB().users[userId] || null;
}

async function saveUser(userId, data) {
  if (useMongoose) {
    await UserModel.findOneAndUpdate({ userId }, data, { upsert: true, new: true });
    return data;
  }
  const db = readDB();
  db.users[userId] = data;
  writeDB(db);
  return data;
}

async function updateUserField(userId, updates) {
  if (useMongoose) {
    return await UserModel.findOneAndUpdate({ userId }, { $set: updates }, { new: true }).lean();
  }
  const db = readDB();
  db.users[userId] = { ...db.users[userId], ...updates };
  writeDB(db);
  return db.users[userId];
}

async function pushToUserArray(userId, field, item) {
  if (useMongoose) {
    return await UserModel.findOneAndUpdate(
      { userId },
      { $push: { [field]: { $each: [item], $position: 0 } } },
      { new: true }
    ).lean();
  }
  const db = readDB();
  db.users[userId][field] = [item, ...(db.users[userId][field] || [])];
  writeDB(db);
  return db.users[userId];
}

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://socialmint.org",
  "https://www.socialmint.org",
  "https://socialmint-six.vercel.app",
  "http://localhost:5173",
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(generalLimiter);

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1: Login
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { userId, name, provider, email } = req.body;
    if (!userId || !name || !provider) {
      return res.status(400).json({ error: "userId, name, and provider are required." });
    }

    let user = await getUser(userId);

    if (user) {
      // Returning user — update last login, return existing wallet
      await updateUserField(userId, { lastLoginAt: new Date() });
      let balance = 0;
      try { balance = await getWalletBalance(user.circleWalletId); } catch {}
      return res.json({
        token: makeToken(userId),
        user: {
          userId: user.userId, name: user.name, provider: user.provider,
          circleWalletId: user.circleWalletId,
          circleWalletAddress: user.circleWalletAddress,
          totalAnalyses: user.totalAnalyses || 0,
          freeRunsUsed: user.freeRunsUsed || 0,
          network: process.env.USE_ARC === "true" ? "Arc Testnet" : process.env.USE_MAINNET === "true" ? "Base Mainnet" : "Base Testnet",
          balance,
        },
      });
    }

    // New user — create Circle wallet
    console.log(`🆕 New user: ${name} (${provider})`);
    let wallet;
    try {
      wallet = await createUserWallet(userId, name);
    } catch (e) {
      console.error("Circle wallet error:", e.message);
      wallet = { id: "mock-" + userId, address: "0x" + Math.random().toString(16).slice(2, 42) };
    }

    const newUser = {
      userId, name, email, provider,
      circleWalletId: wallet.id,
      circleWalletAddress: wallet.address,
      totalAnalyses: 0, totalSpentUsdc: 0,
      freeRunsUsed: 0,
      transactions: [], analyses: [],
      createdAt: new Date(), lastLoginAt: new Date(),
    };
    await saveUser(userId, newUser);

    // Auto-fund on testnet (Base Sepolia or Arc Testnet) but not mainnet
    if (process.env.USE_MAINNET !== "true") {
      try {
        await fundTestWallet(wallet.address);
        console.log("💧 Auto-funded new wallet with testnet USDC:", wallet.address);
      } catch (e) {
        console.log("⚠️ Auto-fund failed (user can manually use faucet):", e.message);
      }
    }

    let balance = 0;
    try { balance = await getWalletBalance(wallet.id); } catch {}

    res.status(201).json({
      token: makeToken(userId),
      user: {
        userId, name, provider,
        circleWalletId: wallet.id,
        circleWalletAddress: wallet.address,
        network: process.env.USE_ARC === "true" ? "Arc Testnet" : process.env.USE_MAINNET === "true" ? "Base Mainnet" : "Base Testnet",
        totalAnalyses: 0,
        freeRunsUsed: 0,
        balance, isNew: true,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2: Wallet Balance
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/wallet/balance", requireAuth, async (req, res) => {
  try {
    const user = await getUser(req.user.userId);
    let balance = 0;
    try { balance = await getWalletBalance(user.circleWalletId); } catch {}
    res.json({
      balance,
      walletAddress: user.circleWalletAddress,
      totalAnalyses: user.totalAnalyses || 0,
      totalSpentUsdc: user.totalSpentUsdc || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch balance." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 3: Analyze
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/analyze", requireAuth, analysisLimiter, async (req, res) => {
  const { platform, niche, goals, isFreeDemo } = req.body;
  const userId = req.user.userId;

  if (!platform || !niche || !goals?.length) {
    return res.status(400).json({ error: "platform, niche, and goals are required." });
  }

  let circleTransfer = null;

  if (!isFreeDemo) {
    try {
      const user = await getUser(userId);
      circleTransfer = await chargeUser(user.circleWalletId);
      console.log(`💳 Charged 0.50 USDC — TX: ${circleTransfer.id}`);
    } catch (paymentErr) {
      console.error("❌ Payment error:", paymentErr.message);
      console.error("❌ Circle response:", JSON.stringify(paymentErr.response?.data, null, 2));
      return res.status(402).json({
        error: paymentErr.message.includes("Insufficient")
          ? "Not enough USDC in your wallet. Please top up and try again."
          : "Payment failed. Please try again.",
      });
    }

    // Save pending transaction
    await pushToUserArray(userId, "transactions", {
      txId: circleTransfer.id, amount: 0.50,
      platform, status: "pending",
      createdAt: new Date().toISOString(),
    });
  } else {
    // ── Enforce free run limit server-side ──────────────────────────────────
    const user = await getUser(userId);
    const freeRunsUsed = user.freeRunsUsed || 0;
    const FREE_LIMIT = 3;

    if (freeRunsUsed >= FREE_LIMIT) {
      return res.status(402).json({
        error: "Free demos used up. Please top up your wallet to continue.",
        code: "FREE_LIMIT_REACHED",
        freeRunsUsed,
      });
    }

    // Increment free runs counter in MongoDB
    await updateUserField(userId, { freeRunsUsed: freeRunsUsed + 1 });
    console.log(`🎁 Free demo ${freeRunsUsed + 1}/${FREE_LIMIT}: ${platform} — ${userId}`);
  }

  // Call Anthropic
  const goalLabels = {
    products: "products or services to sell",
    content:  "content ideas for making money",
    marketing:"marketing channels and strategies to grow",
  };
  const goalText = goals.map(g => goalLabels[g]).join(", ");
  const prompt = `You are a sharp social media monetization strategist. Analyze the user's social media presence and give specific, actionable ideas.

Platform: ${platform}
Their description: ${niche}
They want to discover: ${goalText}

Respond ONLY in valid JSON (no markdown, no backticks, no preamble):
{
  "summary": "2-sentence sharp insight about their position and opportunity",
  "products": [{"title": "name", "why": "why it fits their audience", "price_range": "$X–$Y"}],
  "content": [{"idea": "title", "format": "Reel/Thread/Short/etc", "hook": "opening hook line"}],
  "marketing": [{"channel": "name", "tactic": "specific tactic", "expected_reach": "description"}]
}
Include only sections for: ${goalText}. Each array = exactly 4 items. Be specific and concrete.`;

  try {
    const aiRes = await axios.post(
      "https://api.anthropic.com/v1/messages",
      { model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] },
      { headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } }
    );

    const text     = aiRes.data.content.map(c => c.text || "").join("");
    const analysis = JSON.parse(text.replace(/```json|```/g, "").trim());

    // Save analysis to history
    const analysisRecord = {
      id: circleTransfer?.id || "demo-" + Date.now(),
      platform, niche, goals,
      summary:   analysis.summary,
      products:  analysis.products  || [],
      content:   analysis.content   || [],
      marketing: analysis.marketing || [],
      charged:   isFreeDemo ? "Free" : "0.50 USDC",
      isFreeDemo: !!isFreeDemo,
      createdAt: new Date().toISOString(),
    };

    await pushToUserArray(userId, "analyses", analysisRecord);

    // Update stats
    const user = await getUser(userId);
    const updates = { totalAnalyses: (user.totalAnalyses || 0) + 1 };
    if (!isFreeDemo) {
      updates.totalSpentUsdc = parseFloat(((user.totalSpentUsdc || 0) + 0.50).toFixed(2));
      // Update transaction status
      const txList = (user.transactions || []).map(t =>
        t.txId === circleTransfer?.id ? { ...t, status: "confirmed" } : t
      );
      updates.transactions = txList;
    }
    await updateUserField(userId, updates);

    res.json({
      ...analysis, platform, goals, niche,
      txId: circleTransfer?.id || "free-demo",
      charged: isFreeDemo ? "Free demo" : "0.50 USDC",
      isFreeDemo: !!isFreeDemo,
    });

  } catch (aiErr) {
    console.error("❌ AI failed:", aiErr.message);
    if (aiErr.response) console.error("   Data:", JSON.stringify(aiErr.response.data, null, 2));
    if (circleTransfer) {
      const user = await getUser(userId);
      const txList = (user.transactions || []).map(t =>
        t.txId === circleTransfer.id ? { ...t, status: "failed" } : t
      );
      await updateUserField(userId, { transactions: txList });
    }
    res.status(500).json({
      error: isFreeDemo ? "Demo failed. Please try again." : "Analysis failed after payment. Contact support.",
      txId: circleTransfer?.id,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 4: Circle Webhook
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/webhooks/circle", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try { event = JSON.parse(req.body); } catch { return res.status(400).json({ error: "Invalid payload" }); }
  if (event.Type === "transfers.complete") {
    const transferId = event.Data?.transfer?.id;
    if (transferId && useMongoose) {
      await UserModel.updateOne(
        { "transactions.txId": transferId },
        { $set: { "transactions.$.status": "confirmed" } }
      );
    }
  }
  res.json({ received: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 5: Transaction History
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/transactions", requireAuth, async (req, res) => {
  const user = await getUser(req.user.userId);
  res.json({
    transactions: (user.transactions || []).slice(0, 20),
    totalAnalyses: user.totalAnalyses || 0,
    totalSpentUsdc: user.totalSpentUsdc || 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 6: Analyses History
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/analyses", requireAuth, async (req, res) => {
  const user = await getUser(req.user.userId);
  res.json({ analyses: (user.analyses || []).slice(0, 50) });
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    storage: useMongoose ? "MongoDB" : "local file (db.json)",
    env: process.env.NODE_ENV || "development",
    configured: {
      circle: !!process.env.CIRCLE_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      jwt: !!process.env.JWT_SECRET,
      treasury: !!process.env.CIRCLE_TREASURY_ADDRESS,
      mongodb: useMongoose,
    },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
initDB().then(() => {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`\n🚀 SocialMint backend running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
});