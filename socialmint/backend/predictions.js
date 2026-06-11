/**
 * predictions.js — SocialMint Prediction Agent Routes
 * Now with MongoDB persistence for conditions and bet history
 */

const express    = require("express");
const router     = express.Router();
const { ethers } = require("ethers");
const crypto     = require("crypto");
const { getWalletBalance } = require("./circle");

// ── Valid outcomes ────────────────────────────────────────────────────────────
const VALID_OUTCOMES = [
  "recovers", "continuesDropping", "reversesHard",
  "continuesRising", "reverses", "surgesToATH", "staysFlat",
];
const VALID_CONDITIONS = ["dropsBy", "risesBy", "dropsBelow", "risesAbove"];
const TIMEFRAME_SECONDS = { "1min":60, "3min":180, "5min":300, "15min":900 };

// ── Contract setup ────────────────────────────────────────────────────────────
const CONTRACT_ABI = [
  "function placeBet(address user, string asset, string condition, uint256 conditionValue, string outcome, uint256 timeframeSeconds, uint256 amountUsdc, uint256 queueIndex, uint256 queueTotal, bytes32 conditionId) returns (uint256)",
  "function settleBet(uint256 betId, bool won) external",
  "function cancelBet(uint256 betId) external",
  "event BetPlaced(uint256 indexed betId, address indexed user, string asset, uint256 amountUsdc, bytes32 conditionId, uint256 queueIndex, uint256 queueTotal)",
  "event BetSettled(uint256 indexed betId, address indexed user, uint8 result, uint256 payoutUsdc)",
];
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];
const ARC_USDC = "0x3600000000000000000000000000000000000000";

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network");
}
function getAgentWallet() {
  if (!process.env.AGENT_PRIVATE_KEY) throw new Error("AGENT_PRIVATE_KEY not set");
  return new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, getProvider());
}
function getContract() {
  return new ethers.Contract(process.env.PREDICTION_CONTRACT_ADDRESS, CONTRACT_ABI, getAgentWallet());
}

// ── In-memory condition store (synced to MongoDB) ─────────────────────────────
const conditionStore = new Map();

// ── MongoDB model (set after server.js calls initPredictionDB) ────────────────
let ConditionModel = null;
let BetModel       = null;

async function initPredictionDB(mongoose) {
  // Always load from file first — works without MongoDB
  loadConditionsFromFile();

  if (!mongoose || ConditionModel) return;
  try {
    const ConditionSchema = new mongoose.Schema({
      conditionId:       { type: String, required: true, unique: true },
      userId:            String,
      circleWalletId:    String,
      userAddress:       String,
      asset:             String,
      condition:         String,
      conditionValue:    Number,
      outcome:           String,
      timeframe:         String,
      timeframeSeconds:  Number,
      betAmount:         Number,
      repeatCount:       Number,
      totalAllocated:    Number,
      maxLossProtection: Boolean,
      status:            { type: String, default: "watching" },
      consecutiveLosses: { type: Number, default: 0 },
      betsPlaced:        { type: Number, default: 0 },
      betsWon:           { type: Number, default: 0 },
      betsLost:          { type: Number, default: 0 },
      totalWon:          { type: Number, default: 0 },
      totalLost:         { type: Number, default: 0 },
      bets:              { type: Array,  default: [] },
      createdAt:         { type: Date,   default: Date.now },
    }, { strict: false });

    const BetSchema = new mongoose.Schema({
      betId:       String,
      userId:      String,
      conditionId: String,
      asset:       String,
      condition:   String,
      outcome:     String,
      timeframe:   String,
      betAmount:   Number,
      payout:      { type: Number, default: 0 },
      status:      String, // won | lost | cancelled
      txHash:      String,
      queueIndex:  Number,
      queueTotal:  Number,
      settledAt:   Date,
      createdAt:   { type: Date, default: Date.now },
    });

    ConditionModel = mongoose.models.Condition || mongoose.model("Condition", ConditionSchema);
    BetModel       = mongoose.models.Bet       || mongoose.model("Bet",       BetSchema);

    // Load existing active conditions into memory on startup
    const active = await ConditionModel.find({ status: { $in: ["watching","triggered","paused"] } }).lean();
    for (const c of active) {
      conditionStore.set(c.conditionId, c);
    }
    console.log(`[Predictions] Loaded ${active.length} active conditions from MongoDB`);
  } catch (err) {
    console.warn("[Predictions] MongoDB model init failed:", err.message);
  }
}

// ── File-based persistence (works without MongoDB) ────────────────────────────
const fs   = require("fs");
const path = require("path");
const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ users:{}, conditions:{}, bets:[] }, null, 2));
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (!db.conditions) db.conditions = {};
  if (!db.bets)       db.bets       = [];
  return db;
}

function writeDB(d) { fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); }

function saveConditionToFile(cond) {
  try {
    const db = readDB();
    db.conditions[cond.conditionId] = cond;
    writeDB(db);
  } catch (err) {
    console.warn("[Predictions] saveConditionToFile error:", err.message);
  }
}

function saveBetToFile(bet) {
  try {
    const db = readDB();
    const idx = db.bets.findIndex(b => b.betId === bet.betId);
    if (idx >= 0) db.bets[idx] = bet;
    else db.bets.unshift(bet);
    // Keep only last 500 bets in file
    if (db.bets.length > 500) db.bets = db.bets.slice(0, 500);
    writeDB(db);
  } catch (err) {
    console.warn("[Predictions] saveBetToFile error:", err.message);
  }
}

function loadConditionsFromFile() {
  try {
    const db = readDB();
    let count = 0;
    for (const [id, cond] of Object.entries(db.conditions || {})) {
      if (["watching","triggered","paused"].includes(cond.status)) {
        conditionStore.set(id, cond);
        count++;
      }
    }
    if (count > 0) console.log(`[Predictions] Loaded ${count} active conditions from db.json`);
  } catch (err) {
    console.warn("[Predictions] loadConditionsFromFile error:", err.message);
  }
}

async function saveCondition(cond) {
  // Save to MongoDB if available, always save to file as backup
  saveConditionToFile(cond);
  if (!ConditionModel) return;
  try {
    await ConditionModel.findOneAndUpdate({ conditionId: cond.conditionId }, cond, { upsert: true, new: true });
  } catch (err) {
    console.warn("[Predictions] saveCondition MongoDB error:", err.message);
  }
}

async function saveBet(bet) {
  // Save to MongoDB if available, always save to file as backup
  saveBetToFile(bet);
  if (!BetModel) return;
  try {
    await BetModel.findOneAndUpdate({ betId: bet.betId }, bet, { upsert: true, new: true });
  } catch (err) {
    console.warn("[Predictions] saveBet MongoDB error:", err.message);
  }
}

// ── POST /api/predictions/condition ──────────────────────────────────────────
router.post("/condition", async (req, res) => {
  try {
    const { asset, condition, conditionValue, outcome, timeframe, betAmount, repeatCount, maxLossProtection } = req.body;

    if (!asset || !condition || conditionValue == null || !outcome || !timeframe || !betAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!VALID_CONDITIONS.includes(condition)) return res.status(400).json({ error: "Invalid condition" });
    if (!VALID_OUTCOMES.includes(outcome))     return res.status(400).json({ error: "Invalid outcome" });
    if (!TIMEFRAME_SECONDS[timeframe])         return res.status(400).json({ error: "Invalid timeframe" });

    const isDropCondition = condition === "dropsBy" || condition === "dropsBelow";
    const isRiseCondition = condition === "risesBy" || condition === "risesAbove";
    const dropOutcomes    = ["recovers","continuesDropping","reversesHard","staysFlat"];
    const riseOutcomes    = ["continuesRising","reverses","surgesToATH","staysFlat"];
    if (isDropCondition && !dropOutcomes.includes(outcome)) return res.status(400).json({ error: "Outcome doesn't match drop condition" });
    if (isRiseCondition && !riseOutcomes.includes(outcome)) return res.status(400).json({ error: "Outcome doesn't match rise condition" });

    // ── Max 3 active conditions per user ──────────────────────────────────────
    const activeCount = [...conditionStore.values()].filter(
      c => c.userId === req.user.userId && ["watching","triggered"].includes(c.status)
    ).length;
    if (activeCount >= 3) {
      return res.status(400).json({ error: "Max 3 active conditions allowed. Cancel an existing one first." });
    }

    const reps   = Math.min(Math.max(parseInt(repeatCount)||1,1),10);
    const amount = parseFloat(betAmount);
    if (isNaN(amount)||amount<0.5) return res.status(400).json({ error: "Minimum bet is 0.50 USDC" });

    const { getUser } = req.app.locals;
    const dbUser = await getUser(req.user.userId);
    if (!dbUser?.circleWalletId) return res.status(400).json({ error: "No Circle wallet found" });

    const totalNeeded = amount * reps;
    const balance     = await getWalletBalance(dbUser.circleWalletId);
    if (balance < totalNeeded) {
      return res.status(400).json({ error: `Insufficient balance. Need ${totalNeeded.toFixed(2)} USDC, have ${balance.toFixed(2)} USDC.` });
    }

    const conditionId = "0x" + crypto.randomBytes(32).toString("hex");
    const conditionData = {
      conditionId,
      userId:            req.user.userId,
      circleWalletId:    dbUser.circleWalletId,
      userAddress:       dbUser.circleWalletAddress || null,
      asset:             asset.toUpperCase(),
      condition, conditionValue: parseFloat(conditionValue),
      outcome, timeframe,
      timeframeSeconds:  TIMEFRAME_SECONDS[timeframe],
      betAmount: amount, repeatCount: reps, totalAllocated: totalNeeded,
      maxLossProtection: Boolean(maxLossProtection),
      autoReactivate:    Boolean(req.body.autoReactivate),
      status: "watching",
      consecutiveLosses: 0, betsPlaced: 0, betsWon: 0, betsLost: 0,
      totalWon: 0, totalLost: 0, bets: [],
      createdAt: new Date().toISOString(),
    };

    conditionStore.set(conditionId, conditionData);
    await saveCondition(conditionData);

    console.log(`[Predictions] ✅ Condition created — ${asset} ${condition} ${conditionValue}% → ${outcome} · ${reps}× ${amount} USDC`);
    res.json({ success: true, conditionId, message: `Agent activated — watching ${asset}`, totalAllocated: totalNeeded, condition: conditionData });

  } catch (err) {
    console.error("[Predictions] Create condition error:", err.message);
    res.status(500).json({ error: "Failed to create condition" });
  }
});

// ── GET /api/predictions/conditions ──────────────────────────────────────────
router.get("/conditions", async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    // Try MongoDB first for persistence
    if (ConditionModel) {
      const total = await ConditionModel.countDocuments({ userId: req.user.userId, status: { $ne: "cancelled" } });
      const conditions = await ConditionModel.find({ userId: req.user.userId, status: { $ne: "cancelled" } })
        .sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
      const merged = conditions.map(c => conditionStore.get(c.conditionId) || c);
      return res.json({ conditions: merged, total, page, pages: Math.ceil(total/limit) });
    }

    // Fallback: read from db.json file (persists across restarts)
    const db   = readDB();
    const mine = Object.values(db.conditions || {})
      .filter(c => c.userId === req.user.userId && c.status !== "cancelled")
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    // Merge with in-memory for live status
    const merged    = mine.map(c => conditionStore.get(c.conditionId) || c);
    const total     = merged.length;
    const paginated = merged.slice(skip, skip+limit);
    return res.json({ conditions: paginated, total, page, pages: Math.ceil(total/limit) });
  } catch (err) {
    console.error("[Predictions] GET conditions error:", err.message);
    res.status(500).json({ error: "Failed to fetch conditions" });
  }
});

// ── GET /api/predictions/active ───────────────────────────────────────────────
router.get("/active", (req, res) => {
  const mine = [];
  for (const [,c] of conditionStore) {
    if (c.userId !== req.user.userId) continue;
    for (const bet of c.bets) {
      if (bet.status === "active") {
        mine.push({
          betId: bet.betId, conditionId: c.conditionId,
          asset: c.asset, condition: c.condition, conditionValue: c.conditionValue,
          outcome: c.outcome, timeframe: c.timeframe, betAmount: c.betAmount,
          queueIndex: bet.queueIndex, queueTotal: c.repeatCount,
          placedAt: bet.placedAt, expiresAt: bet.expiresAt,
          priceAtPlacement: bet.priceAtPlacement, txHash: bet.txHash,
        });
      }
    }
  }
  res.json({ bets: mine, total: mine.length });
});

// ── GET /api/predictions/history ──────────────────────────────────────────────
router.get("/history", async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    // Try MongoDB first
    if (BetModel) {
      const total = await BetModel.countDocuments({ userId: req.user.userId });
      const bets  = await BetModel.find({ userId: req.user.userId })
        .sort({ settledAt: -1 }).skip(skip).limit(limit).lean();
      return res.json({ bets, total, page, pages: Math.ceil(total/limit) });
    }

    // Fallback: read from db.json file (persists across restarts)
    const db      = readDB();
    const allBets = (db.bets || []).filter(b => b.userId === req.user.userId);
    allBets.sort((a,b) => new Date(b.settledAt||0) - new Date(a.settledAt||0));
    const paginated = allBets.slice(skip, skip+limit);
    res.json({ bets: paginated, total: allBets.length, page, pages: Math.ceil(allBets.length/limit) });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ── POST /api/predictions/condition/:conditionId/resume ───────────────────────
router.post("/condition/:conditionId/resume", async (req, res) => {
  try {
    const cond = conditionStore.get(req.params.conditionId);
    if (!cond) return res.status(404).json({ error: "Condition not found" });
    if (cond.userId !== req.user.userId) return res.status(403).json({ error: "Not your condition" });
    if (cond.status !== "paused") return res.status(400).json({ error: "Condition is not paused" });

    cond.status            = "watching";
    cond.consecutiveLosses = 0;
    await saveCondition(cond);

    console.log(`[Predictions] ▶ Condition resumed — ${cond.asset} ${cond.condition} ${cond.conditionValue}%`);
    res.json({ success: true, message: "Condition resumed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to resume condition" });
  }
});
router.delete("/condition/:conditionId", async (req, res) => {
  try {
    const cond = conditionStore.get(req.params.conditionId);
    if (!cond) return res.status(404).json({ error: "Condition not found" });
    if (cond.userId !== req.user.userId) return res.status(403).json({ error: "Not your condition" });
    if (cond.status === "cancelled") return res.status(400).json({ error: "Already cancelled" });

    if (process.env.PREDICTION_CONTRACT_ADDRESS) {
      const contract = getContract();
      for (const bet of cond.bets) {
        if (bet.status === "active" && !bet.betId.startsWith("chain-") && !bet.betId.startsWith("dev-")) {
          try {
            const tx = await contract.cancelBet(BigInt(bet.betId));
            await tx.wait();
            bet.status    = "cancelled";
            bet.settledAt = new Date().toISOString();
          } catch (e) {
            console.warn(`[Predictions] Could not cancel bet ${bet.betId}:`, e.message);
          }
        }
      }
    }

    cond.status = "cancelled";
    await saveCondition(cond);
    res.json({ success: true, message: "Condition cancelled." });
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel condition" });
  }
});

// ── Internal: chargeUserForBet ────────────────────────────────────────────────
// Deducts bet amount from user's Circle wallet → agent wallet before placing on-chain
async function chargeUserForBet(circleWalletId, amount) {
  if (!circleWalletId) return null;
  try {
    const { chargeUserForBet: circleCharge } = require("./circle");
    const transfer = await circleCharge(circleWalletId, amount);
    console.log(`[Predictions] 💳 Charged ${amount} USDC from user Circle wallet — TX: ${transfer?.id}`);
    return transfer;
  } catch (err) {
    console.error("[Predictions] chargeUserForBet error:", err.message);
    throw new Error(`Payment failed: ${err.message}`);
  }
}

// ── Internal: placeBetOnChain ─────────────────────────────────────────────────
async function placeBetOnChain(cond, queueIndex, currentPrice) {
  if (!process.env.PREDICTION_CONTRACT_ADDRESS || !process.env.AGENT_PRIVATE_KEY) {
    return { betId:"dev-"+Date.now(), txHash:"0x0", expiresAt:new Date(Date.now()+cond.timeframeSeconds*1000).toISOString(), priceAtPlacement:currentPrice, queueIndex };
  }
  try {
    const agentWallet = getAgentWallet();
    const contract    = getContract();
    const amountMicro = BigInt(Math.round(cond.betAmount*1_000_000));

    // Step 1: Charge user's Circle wallet first (real USDC flow)
    if (cond.circleWalletId) {
      try {
        await chargeUserForBet(cond.circleWalletId, cond.betAmount);
      } catch (chargeErr) {
        console.error("[Predictions] User charge failed:", chargeErr.message);
        return null;
      }
    }

    // Step 2: Approve contract to spend agent wallet USDC
    const usdc      = new ethers.Contract(ARC_USDC, USDC_ABI, agentWallet);
    const allowance = await usdc.allowance(agentWallet.address, process.env.PREDICTION_CONTRACT_ADDRESS);
    if (allowance < amountMicro) {
      const tx = await usdc.approve(process.env.PREDICTION_CONTRACT_ADDRESS, amountMicro*1000n);
      await tx.wait();
    }

    // Step 3: Place bet — use user's Circle wallet address so it shows on-chain as theirs
    const userOnChainAddress = cond.userAddress || agentWallet.address;
    const condBytes = ethers.zeroPadValue(ethers.toBeArray(BigInt(cond.conditionId.replace(/[^0-9a-fx]/gi,"").slice(0,66))),32);
    const tx = await contract.placeBet(
      userOnChainAddress,  // ← user's address shows in contract events
      cond.asset, cond.condition,
      Math.round(cond.conditionValue*100),
      cond.outcome, cond.timeframeSeconds,
      amountMicro, queueIndex, cond.repeatCount, condBytes
    );
    const receipt = await tx.wait();

    let betId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name==="BetPlaced") { betId = parsed.args.betId.toString(); break; }
      } catch(_) {}
    }

    if (!betId) betId = "chain-" + Date.now();

    console.log(`[Predictions] ✅ On-chain bet placed — user: ${userOnChainAddress} — outcome: ${cond.outcome} — tx: ${receipt.hash}`);
    return { betId, txHash: receipt.hash, expiresAt: new Date(Date.now()+cond.timeframeSeconds*1000).toISOString(), priceAtPlacement: currentPrice, queueIndex };

  } catch (err) {
    console.error("[Predictions] placeBetOnChain error:", err.message);
    return null;
  }
}

// ── Internal: settleBetOnChain ────────────────────────────────────────────────
async function settleBetOnChain(betId, won) {
  // chain- or dev- prefix = fallback ID, settle in memory only
  if (!process.env.PREDICTION_CONTRACT_ADDRESS || betId.startsWith("dev-") || betId.startsWith("chain-")) {
    console.log(`[Predictions] Settling ${betId} in memory only (${won?"WON":"LOST"})`);
    return true;
  }
  try {
    const contract = getContract();
    const tx = await contract.settleBet(BigInt(betId), won);
    await tx.wait();
    return true;
  } catch (err) {
    console.error(`[Predictions] settleBetOnChain error (bet ${betId}):`, err.message);
    return false;
  }
}

// ── Internal: updateConditionInDB ─────────────────────────────────────────────
async function updateConditionInDB(cond) {
  await saveCondition(cond);
}

// ── Internal: recordSettledBet ────────────────────────────────────────────────
async function recordSettledBet(cond, bet) {
  await saveBet({
    betId:      bet.betId,
    userId:     cond.userId,
    conditionId:cond.conditionId,
    asset:      cond.asset,
    condition:  cond.condition,
    outcome:    cond.outcome,
    timeframe:  cond.timeframe,
    betAmount:  cond.betAmount,
    payout:     bet.payout || 0,
    status:     bet.status,
    txHash:     bet.txHash,
    queueIndex: bet.queueIndex,
    queueTotal: cond.repeatCount,
    settledAt:  new Date(bet.settledAt),
    createdAt:  new Date(),
  });
}

module.exports = router;
module.exports.conditionStore         = conditionStore;
module.exports.placeBetOnChain        = placeBetOnChain;
module.exports.settleBetOnChain       = settleBetOnChain;
module.exports.updateConditionInDB    = updateConditionInDB;
module.exports.recordSettledBet       = recordSettledBet;
module.exports.initPredictionDB       = initPredictionDB;
module.exports.loadConditionsFromFile = loadConditionsFromFile;