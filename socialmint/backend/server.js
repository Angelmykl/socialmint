/**
 * server.js — SocialMint Backend
 * Complete file — replace your existing server.js with this one
 */

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const jwt      = require("jsonwebtoken");
const axios    = require("axios");
const fs       = require("fs");
const path     = require("path");

const { loginLimiter, analysisLimiter, generalLimiter, predictionLimiter } = require("./middleware/rateLimiter");
const requireAuth = require("./middleware/auth");
const {
  createUserWallet, getWalletBalance,
  chargeUser, fundTestWallet,
} = require("./circle");

// ── Prediction Agent ──────────────────────────────────────────────────────────
const predictionRoutes = require("./predictions");
const agentMonitor     = require("./agentMonitor");
const { initPredictionDB, loadConditionsFromFile } = require("./predictions");

// ── Influence Escrow ── (coming soon)

const app = express();
app.set("trust proxy", 1);

// ── Smart Database Layer ──────────────────────────────────────────────────────
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
      // Initialize prediction agent DB models
      await initPredictionDB(mongoose);
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
  origin: true,
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

    if (process.env.USE_MAINNET !== "true") {
      try {
        await fundTestWallet(wallet.address);
        console.log("💧 Auto-funded new wallet:", wallet.address);
      } catch (e) {
        console.log("⚠️ Auto-fund failed:", e.message);
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
// ROUTE: Balance refresh
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/balance", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await getUser(userId);
    if (!user?.circleWalletId) return res.json({ balance: 0 });
    const balance = await getWalletBalance(user.circleWalletId);
    res.json({ balance });
  } catch (e) {
    console.error("Balance refresh error:", e.message);
    res.json({ balance: 0 });
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
      return res.status(402).json({
        error: paymentErr.message.includes("Insufficient")
          ? "Not enough USDC in your wallet. Please top up and try again."
          : "Payment failed. Please try again.",
      });
    }

    await pushToUserArray(userId, "transactions", {
      txId: circleTransfer.id, amount: 0.50,
      platform, status: "pending",
      createdAt: new Date().toISOString(),
    });
  } else {
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

    await updateUserField(userId, { freeRunsUsed: freeRunsUsed + 1 });
    console.log(`🎁 Free demo ${freeRunsUsed + 1}/${FREE_LIMIT}: ${platform} — ${userId}`);
  }

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
      { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] },
      { headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, timeout: 55000 }
    );

    const text = aiRes.data.content.map(c => c.text || "").join("");

    // Robust JSON extraction — find the first { and last } to handle any wrapping
    let cleanText = text.replace(/```json|```/g, "").trim();
    const firstBrace = cleanText.indexOf("{");
    const lastBrace  = cleanText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanText = cleanText.slice(firstBrace, lastBrace + 1);
    }
    const analysis = JSON.parse(cleanText);

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

    const user = await getUser(userId);
    const updates = { totalAnalyses: (user.totalAnalyses || 0) + 1 };
    if (!isFreeDemo) {
      updates.totalSpentUsdc = parseFloat(((user.totalSpentUsdc || 0) + 0.50).toFixed(2));
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

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 7: Prediction Agent
// ─────────────────────────────────────────────────────────────────────────────
app.use("/api/predictions", predictionLimiter, requireAuth, predictionRoutes);

// Live prices for the prediction UI ticker (no auth needed)
app.get("/api/prices", (req, res) => res.json(agentMonitor.getCurrentPrices()));

// Manual house sweep — trigger anytime to push earnings to treasury
app.post("/api/admin/sweep", requireAuth, async (req, res) => {
  try {
    await agentMonitor.triggerSweep();
    res.json({ success: true, message: "House sweep triggered — check server logs for result" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
      predictionContract: !!process.env.PREDICTION_CONTRACT_ADDRESS,
    },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
initDB().then(() => {
  // Make getUser available to prediction routes
  app.locals.getUser = getUser;

  // Load prediction conditions from file on startup (works without MongoDB)
  loadConditionsFromFile();

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`\n🚀 SocialMint backend running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);

    // Start prediction agent background monitor
    agentMonitor.start();
  });
});