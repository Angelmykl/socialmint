const axios  = require("axios");
const forge  = require("node-forge");
const { v4: uuidv4 } = require("uuid");

const BASE_URL = "https://api.circle.com/v1/w3s";

// Blockchain constants
const USDC_TOKEN_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_TOKEN_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_TOKEN_ARC_TESTNET  = "0x3600000000000000000000000000000000000000";

// Network selector
function getNetwork() {
  if (process.env.USE_MAINNET === "true") {
    return { blockchain: "BASE-MAINNET", tokenAddress: USDC_TOKEN_BASE_MAINNET };
  }
  if (process.env.USE_ARC === "true") {
    return { blockchain: "ARC-TESTNET", tokenAddress: USDC_TOKEN_ARC_TESTNET };
  }
  return { blockchain: "BASE-SEPOLIA", tokenAddress: USDC_TOKEN_BASE_SEPOLIA };
}

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
});

async function getEntitySecretCiphertext() {
  const entitySecret = process.env.ENTITY_SECRET;
  console.log("   Checking ENTITY_SECRET:", entitySecret ? `Found (${entitySecret.length} chars)` : "MISSING");
  if (!entitySecret) throw new Error("ENTITY_SECRET missing from .env");
  const res = await axios.get(`${BASE_URL}/config/entity/publicKey`, { headers: headers() });
  const publicKeyPem = res.data.data.publicKey;
  const publicKey   = forge.pki.publicKeyFromPem(publicKeyPem);
  const secretBytes = forge.util.hexToBytes(entitySecret);
  const encrypted   = publicKey.encrypt(secretBytes, "RSA-OAEP", { md: forge.md.sha256.create() });
  return forge.util.encode64(encrypted);
}

async function createWalletSet(name = "SocialMint") {
  const entitySecretCiphertext = await getEntitySecretCiphertext();
  const res = await axios.post(
    `${BASE_URL}/developer/walletSets`,
    { idempotencyKey: uuidv4(), name, entitySecretCiphertext },
    { headers: headers() }
  );
  return res.data.data.walletSet;
}

async function createTreasuryWallet() {
  const entitySecretCiphertext = await getEntitySecretCiphertext();
  const { blockchain } = getNetwork();
  const res = await axios.post(
    `${BASE_URL}/developer/wallets`,
    {
      idempotencyKey: uuidv4(),
      entitySecretCiphertext,
      accountType: "SCA",
      blockchains: [blockchain],
      count: 1,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      metadata: [{ name: "SocialMint Treasury", refId: "treasury" }],
    },
    { headers: headers() }
  );
  const wallet = res.data.data.wallets[0];
  console.log("✅ Treasury wallet created:", wallet.id);
  console.log("   Address:", wallet.address);
  console.log("   Network:", blockchain);
  return wallet;
}

async function createUserWallet(userId, displayName) {
  const entitySecretCiphertext = await getEntitySecretCiphertext();
  const { blockchain } = getNetwork();
  const res = await axios.post(
    `${BASE_URL}/developer/wallets`,
    {
      idempotencyKey: uuidv4(),
      entitySecretCiphertext,
      accountType: "SCA",
      blockchains: [blockchain],
      count: 1,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      metadata: [{ name: displayName, refId: userId }],
    },
    { headers: headers() }
  );
  return res.data.data.wallets[0];
}

async function getWalletBalance(walletId) {
  const res = await axios.get(
    `${BASE_URL}/wallets/${walletId}/balances`,
    { headers: headers() }
  );
  const data = res.data.data;
  const balances = data.tokenBalances || [];

  let usdc = balances.find(b => b.token?.symbol === "USDC");

  if (!usdc) {
    usdc = balances.find(b =>
      b.token?.isNative === true ||
      b.token?.name?.toLowerCase().includes("usd coin") ||
      b.token?.name?.toLowerCase().includes("usdc")
    );
  }

  if (!usdc && data.nativeBalance) {
    return parseFloat(data.nativeBalance.amount || 0);
  }

  return usdc ? parseFloat(usdc.amount) : 0.0;
}

// ── Charge user 0.50 USDC → treasury (for AI analysis) ───────────────────────
async function chargeUser(userWalletId) {
  const balance = await getWalletBalance(userWalletId);
  if (balance < 0.50) {
    throw new Error(`Insufficient balance. Has ${balance} USDC, needs 0.50 USDC.`);
  }
  const entitySecretCiphertext = await getEntitySecretCiphertext();
  const { blockchain, tokenAddress } = getNetwork();

  console.log("   Attempting transfer from:", userWalletId);
  console.log("   To treasury:", process.env.CIRCLE_TREASURY_ADDRESS);
  console.log("   Network:", blockchain);
  console.log("   Token:", tokenAddress);

  const res = await axios.post(
    `${BASE_URL}/developer/transactions/transfer`,
    {
      idempotencyKey: uuidv4(),
      entitySecretCiphertext,
      walletId: userWalletId,
      destinationAddress: process.env.CIRCLE_TREASURY_ADDRESS,
      amounts: ["0.50"],
      tokenAddress,
      blockchain,
      feeLevel: "MEDIUM",
    },
    { headers: headers() }
  );
  console.log("   Transfer response:", JSON.stringify(res.data, null, 2));
  return res.data.data;
}

// ── Charge user any amount → agent wallet (for prediction bets) ───────────────
// Different from chargeUser — this sends to the AGENT wallet not treasury
// The agent wallet then funds the on-chain bet contract transaction
async function chargeUserForBet(userWalletId, amount) {
  const balance = await getWalletBalance(userWalletId);
  if (balance < amount) {
    throw new Error(`Insufficient balance. Has ${balance.toFixed(2)} USDC, needs ${amount.toFixed(2)} USDC.`);
  }

  // Get the agent wallet's on-chain address to receive the funds
  const agentAddress = process.env.AGENT_WALLET_ADDRESS;
  if (!agentAddress) {
    // Fallback: derive from private key
    const { ethers } = require("ethers");
    const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY);
    console.log(`[Circle] Charging ${amount} USDC from user wallet → agent ${wallet.address}`);
  }

  const destinationAddress = agentAddress ||
    (() => {
      const { ethers } = require("ethers");
      return new ethers.Wallet(process.env.AGENT_PRIVATE_KEY).address;
    })();

  const entitySecretCiphertext = await getEntitySecretCiphertext();
  const { blockchain, tokenAddress } = getNetwork();

  console.log(`[Circle] Charging ${amount} USDC from user ${userWalletId} → agent ${destinationAddress}`);

  const res = await axios.post(
    `${BASE_URL}/developer/transactions/transfer`,
    {
      idempotencyKey: uuidv4(),
      entitySecretCiphertext,
      walletId:            userWalletId,
      destinationAddress,
      amounts:             [amount.toFixed(6)],
      tokenAddress,
      blockchain,
      feeLevel: "MEDIUM",
    },
    { headers: headers() }
  );

  console.log(`[Circle] ✅ Bet charge complete — TX: ${res.data.data?.id}`);
  return res.data.data;
}

async function getTransactionStatus(transactionId) {
  const res = await axios.get(
    `${BASE_URL}/transactions/${transactionId}`,
    { headers: headers() }
  );
  return res.data.data.transaction;
}

async function fundTestWallet(walletAddress) {
  const { blockchain } = getNetwork();
  const res = await axios.post(
    "https://api.circle.com/v1/faucet/drips",
    { address: walletAddress, blockchain, native: false, usdc: true },
    { headers: headers() }
  );
  return res.data;
}

module.exports = {
  createWalletSet,
  createTreasuryWallet,
  createUserWallet,
  getWalletBalance,
  chargeUser,
  chargeUserForBet,
  getTransactionStatus,
  fundTestWallet,
};