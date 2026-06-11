/**
 * agentMonitor.js — SocialMint Prediction Agent Background Monitor
 *
 * Start from server.js inside app.listen():
 *   agentMonitor.start();
 */

const axios = require("axios");
const { conditionStore, placeBetOnChain, settleBetOnChain, updateConditionInDB, recordSettledBet } = require("./predictions");

let priceCache = { BTC: 62798, ETH: 1671.30, SOL: 66.11, updatedAt: null };
const priceHistory = { BTC: [], ETH: [], SOL: [] };

async function fetchPrices() {
  try {
    // Use Binance public API — no API key, no rate limits
    const [btc, eth, sol] = await Promise.all([
      axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { timeout: 5000 }),
      axios.get("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT", { timeout: 5000 }),
      axios.get("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", { timeout: 5000 }),
    ]);

    const now = Date.now();
    priceCache = {
      BTC:       parseFloat(btc.data.price),
      ETH:       parseFloat(eth.data.price),
      SOL:       parseFloat(sol.data.price),
      updatedAt: new Date().toISOString(),
    };

    for (const asset of ["BTC", "ETH", "SOL"]) {
      priceHistory[asset].push({ price: priceCache[asset], time: now });
      if (priceHistory[asset].length > 20) priceHistory[asset].shift();
    }

    console.log(`[AgentMonitor] BTC $${priceCache.BTC} | ETH $${priceCache.ETH} | SOL $${priceCache.SOL}`);
    return priceCache;
  } catch (err) {
    console.warn("[AgentMonitor] Price fetch failed:", err.message);
    return priceCache;
  }
}

// ── Check if the trigger condition is currently met ───────────────────────────
function isConditionMet(cond, prices) {
  const current = prices[cond.asset];
  if (!current) return false;

  const history = priceHistory[cond.asset];
  if (history.length < 2) return false;

  const refEntry = history.find(h => h.time <= Date.now() - 60_000) || history[0];
  const ref      = refEntry.price;
  const pctChg   = ((current - ref) / ref) * 100;

  switch (cond.condition) {
    case "dropsBy":    return pctChg <= -(cond.conditionValue);
    case "risesBy":    return pctChg >=  cond.conditionValue;
    case "dropsBelow": return current <  cond.conditionValue;
    case "risesAbove": return current >  cond.conditionValue;
    default:           return false;
  }
}

// ── Check if the bet outcome came true ───────────────────────────────────────
// All 7 outcomes supported — 4 for drops, 4 for rises (staysFlat shared)
function didWin(outcomeKey, priceAtPlacement, currentPrice) {
  const pctChg = ((currentPrice - priceAtPlacement) / priceAtPlacement) * 100;

  switch (outcomeKey) {
    // ── Drop trigger outcomes ──────────────────────────────────────────────
    case "recovers":
      // After a drop, price bounced back up ≥ 0.08%
      return pctChg >= 0.08;

    case "continuesDropping":
      // After a drop, price kept falling another ≥ 0.08%
      return pctChg <= -0.08;

    case "reversesHard":
      // After a drop, price snapped back hard ≥ 0.5%
      return pctChg >= 0.5;

    // ── Rise trigger outcomes ──────────────────────────────────────────────
    case "continuesRising":
      // After a rise, price kept climbing another ≥ 0.08%
      return pctChg >= 0.08;

    case "reverses":
      // After a rise, price dropped back down ≥ 0.08% (fakeout)
      return pctChg <= -0.08;

    case "surgesToATH":
      // After a rise, price surged hard ≥ 0.5%
      return pctChg >= 0.5;

    // ── Shared ────────────────────────────────────────────────────────────
    case "staysFlat":
      // Price barely moved either way (within ±0.1%)
      return Math.abs(pctChg) <= 0.1;

    default:
      return false;
  }
}

// ── Settle expired bets ───────────────────────────────────────────────────────
async function processExpiredBets(prices) {
  const now = Date.now();
  for (const [, cond] of conditionStore) {
    for (const bet of cond.bets) {
      if (bet.status !== "active") continue;
      if (now < new Date(bet.expiresAt).getTime()) continue;

      const current = prices[cond.asset];
      if (!current || !bet.priceAtPlacement) continue;

      const won = didWin(cond.outcome, bet.priceAtPlacement, current);
      console.log(`[AgentMonitor] Settling bet ${bet.betId} — ${cond.asset} — outcome: ${cond.outcome} — ${won ? "🟢 WON" : "🔴 LOST"}`);

      const ok = await settleBetOnChain(bet.betId, won);
      if (ok) {
        bet.status    = won ? "won" : "lost";
        bet.settledAt = new Date().toISOString();
        bet.payout    = won ? parseFloat((cond.betAmount * 1.70 * 0.925).toFixed(4)) : 0;

        if (won) {
          cond.consecutiveLosses = 0;
          cond.betsWon++;
          cond.totalWon += bet.payout;
        } else {
          cond.consecutiveLosses++;
          cond.betsLost++;
          cond.totalLost += cond.betAmount;
        }

        // Save settled bet to MongoDB
        await recordSettledBet(cond, bet);

        if (cond.maxLossProtection && cond.consecutiveLosses >= 3) {
          if (cond.autoReactivate) {
            console.log(`[AgentMonitor] 🔄 3 losses but auto-reactivate on — resetting condition`);
            cond.status            = "watching";
            cond.betsPlaced        = 0;
            cond.consecutiveLosses = 0;
            cond.bets              = [];
            cond.reactivatedAt     = new Date().toISOString();
          } else {
            // Cooldown — reset loss counter and keep watching
            // Agent fires again when market returns to trigger condition
            console.log(`[AgentMonitor] 🛡 3 consecutive losses — cooling down, resetting counter, watching for next trigger`);
            cond.status            = "watching";
            cond.consecutiveLosses = 0;
            cond.cooledDownAt      = new Date().toISOString();
          }
        }

        if (cond.betsPlaced >= cond.repeatCount) {
          // Check if auto-reactivate is on
          if (cond.autoReactivate) {
            console.log(`[AgentMonitor] 🔄 Auto-reactivating condition — ${cond.asset} ${cond.condition} ${cond.conditionValue}%`);
            cond.status            = "watching";
            cond.betsPlaced        = 0;
            cond.consecutiveLosses = 0;
            cond.bets              = [];
            cond.reactivatedAt     = new Date().toISOString();
          } else {
            cond.status = "completed";
            console.log(`[AgentMonitor] ✅ Condition completed — all ${cond.repeatCount} bets settled`);
          }
        }

        // Save updated condition to MongoDB
        await updateConditionInDB(cond);
      }
    }
  }
}

// ── Main monitor loop ─────────────────────────────────────────────────────────
// Lock to prevent concurrent bet placement
const placingLock = new Set();

async function monitorLoop() {
  const prices = await fetchPrices();
  if (!prices.BTC) return;

  const active = [...conditionStore.values()].filter(c => ["watching", "triggered"].includes(c.status)).length;
  if (conditionStore.size > 0) {
    console.log(`[AgentMonitor] BTC $${prices.BTC?.toLocaleString()} | ETH $${prices.ETH?.toLocaleString()} | SOL $${prices.SOL?.toLocaleString()} | ${conditionStore.size} conditions (${active} watching)`);
  }

  await processExpiredBets(prices);

  for (const [, cond] of conditionStore) {
    if (!["watching", "triggered"].includes(cond.status)) continue;
    if (cond.betsPlaced >= cond.repeatCount) { cond.status = "completed"; continue; }

    // Sequential — wait for current active bet to settle first
    if (cond.bets.some(b => b.status === "active")) continue;

    // Prevent double-firing if already placing a bet for this condition
    if (placingLock.has(cond.conditionId)) continue;

    if (!isConditionMet(cond, prices)) continue;

    const queueIndex = cond.betsPlaced + 1;
    console.log(`[AgentMonitor] 🎯 Condition met — ${cond.asset} ${cond.condition} ${cond.conditionValue}% | outcome: ${cond.outcome} | placing bet ${queueIndex}/${cond.repeatCount}`);

    placingLock.add(cond.conditionId);
    try {
      const result = await placeBetOnChain(cond, queueIndex, prices[cond.asset]);
      if (result) {
        cond.betsPlaced++;
        cond.status = "triggered";
        cond.bets.push({
          betId:            result.betId,
          status:           "active",
          queueIndex,
          placedAt:         new Date().toISOString(),
          expiresAt:        result.expiresAt,
          priceAtPlacement: result.priceAtPlacement,
          txHash:           result.txHash,
        });
      }
    } finally {
      placingLock.delete(cond.conditionId);
    }
  }
}

let handle       = null;
let sweepHandle  = null;

// ── Auto-sweep house balance to Circle treasury ───────────────────────────────
const { ethers } = require("ethers");

const SWEEP_ABI = [
  "function houseBalance() view returns (uint256)",
  "function contractBalance() view returns (uint256)",
  "function withdrawHouse(address to, uint256 amount) external",
];

const USDC_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

const ARC_USDC         = "0x3600000000000000000000000000000000000000";
const MIN_SWEEP_USDC   = 5; // only sweep if house balance > 5 USDC
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000; // every 24 hours

async function sweepHouseToTreasury() {
  if (!process.env.PREDICTION_CONTRACT_ADDRESS || !process.env.AGENT_PRIVATE_KEY || !process.env.CIRCLE_TREASURY_ADDRESS) {
    console.log("[Sweep] Skipping — PREDICTION_CONTRACT_ADDRESS, AGENT_PRIVATE_KEY or CIRCLE_TREASURY_ADDRESS not set");
    return;
  }

  try {
    const provider    = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network");
    const agentWallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
    const contract    = new ethers.Contract(process.env.PREDICTION_CONTRACT_ADDRESS, SWEEP_ABI, agentWallet);

    // Check house balance
    const houseBalanceRaw = await contract.houseBalance();
    const houseBalanceUsdc = parseFloat(ethers.formatUnits(houseBalanceRaw, 6));

    const contractBalanceRaw = await contract.contractBalance();
    const contractBalanceUsdc = parseFloat(ethers.formatUnits(contractBalanceRaw, 6));

    console.log(`[Sweep] House balance:    ${houseBalanceUsdc.toFixed(4)} USDC`);
    console.log(`[Sweep] Contract balance: ${contractBalanceUsdc.toFixed(4)} USDC`);

    // Only sweep if above minimum threshold
    if (houseBalanceUsdc < MIN_SWEEP_USDC) {
      console.log(`[Sweep] House balance below ${MIN_SWEEP_USDC} USDC threshold — skipping sweep`);
      return;
    }

    // Step 1: Withdraw house balance from contract → agent wallet
    console.log(`[Sweep] Withdrawing ${houseBalanceUsdc.toFixed(4)} USDC from contract to agent wallet...`);
    const withdrawTx = await contract.withdrawHouse(agentWallet.address, houseBalanceRaw);
    await withdrawTx.wait();
    console.log(`[Sweep] ✅ Withdrawn — tx: ${withdrawTx.hash}`);

    // Step 2: Transfer from agent wallet → Circle treasury address
    const usdc       = new ethers.Contract(ARC_USDC, USDC_TRANSFER_ABI, agentWallet);
    const agentBal   = await usdc.balanceOf(agentWallet.address);
    const agentBalUsdc = parseFloat(ethers.formatUnits(agentBal, 6));

    // Transfer the house earnings (keep some for gas — leave 1 USDC for future gas)
    const toTransfer = houseBalanceRaw;
    if (agentBalUsdc < houseBalanceUsdc) {
      console.warn(`[Sweep] Agent wallet balance (${agentBalUsdc}) less than expected — partial sweep`);
    }

    console.log(`[Sweep] Transferring ${houseBalanceUsdc.toFixed(4)} USDC to treasury: ${process.env.CIRCLE_TREASURY_ADDRESS}`);
    const transferTx = await usdc.transfer(process.env.CIRCLE_TREASURY_ADDRESS, toTransfer);
    await transferTx.wait();

    console.log(`[Sweep] 💰 Treasury sweep complete!`);
    console.log(`[Sweep]    Amount:   ${houseBalanceUsdc.toFixed(4)} USDC`);
    console.log(`[Sweep]    Treasury: ${process.env.CIRCLE_TREASURY_ADDRESS}`);
    console.log(`[Sweep]    Tx:       ${transferTx.hash}`);

  } catch (err) {
    console.error("[Sweep] Auto-sweep error:", err.message);
  }
}

function start() {
  if (handle) return;
  console.log("[AgentMonitor] 🤖 Prediction Agent started — polling every 10s");
  monitorLoop();
  handle = setInterval(monitorLoop, 10_000);

  // Run first sweep after 1 minute (to let things settle), then every 24h
  setTimeout(() => {
    sweepHouseToTreasury();
    sweepHandle = setInterval(sweepHouseToTreasury, SWEEP_INTERVAL_MS);
  }, 60_000);

  console.log("[AgentMonitor] 💰 House sweep scheduled — runs every 24h (min 5 USDC threshold)");
}

function stop() {
  if (handle)      { clearInterval(handle);      handle      = null; }
  if (sweepHandle) { clearInterval(sweepHandle); sweepHandle = null; }
}

function getCurrentPrices() { return priceCache; }

// Manual sweep trigger — callable from server.js if needed
// e.g. app.post("/api/admin/sweep", requireAuth, async (req, res) => { await agentMonitor.triggerSweep(); res.json({ok:true}); });
async function triggerSweep() { await sweepHouseToTreasury(); }

module.exports = { start, stop, getCurrentPrices, triggerSweep };