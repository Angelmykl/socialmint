/**
 * server.js — SocialMint Backend
 *
 * Runs WITHOUT MongoDB — stores users in a local db.json file.
 * Perfect for development and testing. When you deploy to Railway/Render,
 * swap back to MongoDB by setting MONGODB_URI in environment variables.
 */

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const jwt        = require("jsonwebtoken");
const axios      = require("axios");
const fs         = require("fs");
const path       = require("path");

const { loginLimiter, analysisLimiter, generalLimiter } = require("./middleware/rateLimiter");
const requireAuth = require("./middleware/auth");
const {
  createUserWallet,
  getWalletBalance,
  chargeUser,
  fundTestWallet,
} = require("./circle");

const app = express();

// ── Simple file-based database ────────────────────────────────────────────────
// Stores users in db.json in the backend folder.
// Works on any machine, no setup needed.
const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getUser(userId) {
  const db = readDB();
  return db.users[userId] || null;
}

function saveUser(userId, userData) {
  const db = readDB();
  db.users[userId] = userData;
  writeDB(db);
  return userData;
}

function updateUser(userId, updates) {
  const db = readDB();
  db.users[userId] = { ...db.users[userId], ...updates };
  writeDB(db);
  return db.users[userId];
}

console.log("✅ Using local file database (db.json)");

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(generalLimiter);

// ── JWT helper ────────────────────────────────────────────────────────────────
function makeToken(userId) {
  const secret = process.env.JWT_SECRET || "dev_secret_change_in_production";
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1: Login
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { userId, name, provider, email } = req.body;
    if (!userId || !name || !provider) {
      return res.status(400).json({ error: "userId, name, and provider are required." });
    }

    // Check if user already exists in db.json
    let user = getUser(userId);

    if (user) {
      // Returning user
      user.lastLoginAt = new Date().toISOString();
      saveUser(userId, user);

      let balance = 0;
      try { balance = await getWalletBalance(user.circleWalletId); } catch {}

      return res.json({
        token: makeToken(userId),
        user: {
          userId: user.userId,
          name: user.name,
          provider: user.provider,
          circleWalletId: user.circleWalletId,
          circleWalletAddress: user.circleWalletAddress,
          totalAnalyses: user.totalAnalyses || 0,
          balance,
        },
      });
    }

    // New user — create Circle wallet
    console.log(`🆕 New user: ${name} (${provider})`);
    let wallet;
    try {
      wallet = await createUserWallet(userId, name);
    } catch (walletErr) {
      console.error("Circle wallet creation failed:", walletErr.message);
      // Create a mock wallet for testing if Circle fails
      wallet = {
        id: "mock-wallet-" + userId,
        address: "0x" + Math.random().toString(16).slice(2, 42),
      };
    }

    user = {
      userId, name, email, provider,
      circleWalletId: wallet.id,
      circleWalletAddress: wallet.address,
      totalAnalyses: 0,
      totalSpentUsdc: 0,
      transactions: [],
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    saveUser(userId, user);

    // Testnet faucet — give free test USDC
    if (process.env.NODE_ENV !== "production") {
      try { await fundTestWallet(wallet.address); } catch {}
    }

    let balance = 0;
    try { balance = await getWalletBalance(wallet.id); } catch {}

    res.status(201).json({
      token: makeToken(userId),
      user: {
        userId: user.userId,
        name: user.name,
        provider: user.provider,
        circleWalletId: user.circleWalletId,
        circleWalletAddress: user.circleWalletAddress,
        totalAnalyses: 0,
        balance,
        isNew: true,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2: Wallet Balance
// GET /api/wallet/balance
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/wallet/balance", requireAuth, async (req, res) => {
  try {
    const user = getUser(req.user.userId);
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
// POST /api/analyze
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/analyze", requireAuth, analysisLimiter, async (req, res) => {
  const { platform, niche, goals, isFreeDemo } = req.body;
  const userId = req.user.userId;

  if (!platform || !niche || !goals?.length) {
    return res.status(400).json({ error: "platform, niche, and goals are required." });
  }

  // ── Free demo — skip payment entirely ────────────────────────────────────────
  let circleTransfer = null;
  if (!isFreeDemo) {
    // Step 1: Charge 0.50 USDC via Circle
    try {
      const user = getUser(userId);
      circleTransfer = await chargeUser(user.circleWalletId);
      console.log(`💳 Charged 0.50 USDC — TX: ${circleTransfer.id}`);
    } catch (paymentErr) {
      return res.status(402).json({
        error: paymentErr.message.includes("Insufficient")
          ? "Not enough USDC in your wallet. Please top up and try again."
          : "Payment failed. Please try again.",
      });
    }

    // Step 2: Save pending transaction to db.json
    const user = getUser(userId);
    user.transactions = user.transactions || [];
    user.transactions.unshift({
      txId: circleTransfer.id, amount: 0.50,
      platform, status: "pending", createdAt: new Date().toISOString(),
    });
    saveUser(userId, user);
  } else {
    console.log(`🎁 Free demo analysis: ${platform} — ${userId}`);
  }

  // Step 3: Call Anthropic API
  const goalLabels = {
    products: "products or services to sell",
    content: "content ideas for making money",
    marketing: "marketing channels and strategies to grow",
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
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
      }
    );

    const text     = aiRes.data.content.map(c => c.text || "").join("");
    const analysis = JSON.parse(text.replace(/```json|```/g, "").trim());

    // Update user stats and save full analysis result
    const updatedUser = getUser(userId);
    updatedUser.totalAnalyses = (updatedUser.totalAnalyses || 0) + 1;

    // Save full analysis to analyses history
    const analysisRecord = {
      id: circleTransfer?.id || "demo-" + Date.now(),
      platform,
      niche,
      goals,
      summary: analysis.summary,
      products: analysis.products || [],
      content: analysis.content || [],
      marketing: analysis.marketing || [],
      charged: isFreeDemo ? "Free" : "0.50 USDC",
      isFreeDemo: !!isFreeDemo,
      createdAt: new Date().toISOString(),
    };

    updatedUser.analyses = updatedUser.analyses || [];
    updatedUser.analyses.unshift(analysisRecord);

    if (!isFreeDemo) {
      updatedUser.totalSpentUsdc = parseFloat(((updatedUser.totalSpentUsdc || 0) + 0.50).toFixed(2));
      const tx = updatedUser.transactions?.find(t => t.txId === circleTransfer?.id);
      if (tx) {
        tx.status = "confirmed";
        tx.analysisId = analysisRecord.id;
        tx.niche = niche;
        tx.goals = goals;
      }
    }
    saveUser(userId, updatedUser);

    res.json({
      ...analysis, platform, goals, niche,
      txId: circleTransfer?.id || "free-demo",
      charged: isFreeDemo ? "Free demo" : "0.50 USDC",
      isFreeDemo: !!isFreeDemo,
    });

  } catch (aiErr) {
    console.error("❌ AI failed:", aiErr.message);
    if (aiErr.response) {
      console.error("   Status:", aiErr.response.status);
      console.error("   Data:", JSON.stringify(aiErr.response.data, null, 2));
    }
    if (circleTransfer) {
      const u = getUser(userId);
      const tx = u.transactions?.find(t => t.txId === circleTransfer.id);
      if (tx) tx.status = "failed";
      saveUser(userId, u);
    }
    res.status(500).json({
      error: isFreeDemo
        ? "Demo analysis failed. Please try again."
        : "Analysis failed after payment. Contact support with your TX ID.",
      txId: circleTransfer?.id,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 4: Circle Webhook
// POST /api/webhooks/circle
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/webhooks/circle", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try { event = JSON.parse(req.body); } catch { return res.status(400).json({ error: "Invalid payload" }); }

  if (event.Type === "transfers.complete") {
    const transferId = event.Data?.transfer?.id;
    if (transferId) {
      const db = readDB();
      Object.values(db.users).forEach(user => {
        const tx = user.transactions?.find(t => t.txId === transferId);
        if (tx) { tx.status = "confirmed"; saveUser(user.userId, user); }
      });
    }
  }
  res.json({ received: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 5: Transaction History
// GET /api/transactions
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/transactions", requireAuth, (req, res) => {
  const user = getUser(req.user.userId);
  res.json({
    transactions: (user.transactions || []).slice(0, 20),
    totalAnalyses: user.totalAnalyses || 0,
    totalSpentUsdc: user.totalSpentUsdc || 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 6: Analyses History (with full results)
// GET /api/analyses
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/analyses", requireAuth, (req, res) => {
  const user = getUser(req.user.userId);
  res.json({
    analyses: (user.analyses || []).slice(0, 50),
  });
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    storage: "local file (db.json)",
    env: process.env.NODE_ENV || "development",
    configured: {
      circle: !!process.env.CIRCLE_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      jwt: !!process.env.JWT_SECRET,
      treasury: !!process.env.CIRCLE_TREASURY_ADDRESS,
    },
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n🚀 SocialMint backend running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});