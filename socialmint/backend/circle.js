const axios  = require("axios");
const forge  = require("node-forge");
const { v4: uuidv4 } = require("uuid");

const BASE_URL = "https://api.circle.com/v1/w3s";

const USDC_TOKEN_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_TOKEN_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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
  const res = await axios.post(
    `${BASE_URL}/developer/wallets`,
    {
      idempotencyKey: uuidv4(),
      entitySecretCiphertext,
      accountType: "SCA",
      blockchains: ["BASE-SEPOLIA"],
      count: 1,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      metadata: [{ name: "SocialMint Treasury", refId: "treasury" }],
    },
    { headers: headers() }
  );
  const wallet = res.data.data.wallets[0];
  console.log("✅ Treasury wallet created:", wallet.id);
  console.log("   Address:", wallet.address);
  return wallet;
}

async function createUserWallet(userId, displayName) {
  const entitySecretCiphertext = await getEntitySecretCiphertext();
  const res = await axios.post(
    `${BASE_URL}/developer/wallets`,
    {
      idempotencyKey: uuidv4(),
      entitySecretCiphertext,
      accountType: "SCA",
      blockchains: ["BASE-SEPOLIA"],
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
  const balances = res.data.data.tokenBalances || [];
  const usdc = balances.find(b => b.token.symbol === "USDC");
  return usdc ? parseFloat(usdc.amount) : 0.0;
}

async function chargeUser(userWalletId) {
  const balance = await getWalletBalance(userWalletId);
  if (balance < 0.50) {
    throw new Error(`Insufficient balance. Has ${balance} USDC, needs 0.50 USDC.`);
  }
  const entitySecretCiphertext = await getEntitySecretCiphertext();
  const isMainnet = process.env.NODE_ENV === "production";
  console.log("   Attempting transfer from:", userWalletId);
  console.log("   To treasury:", process.env.CIRCLE_TREASURY_ADDRESS);
  console.log("   Token:", isMainnet ? USDC_TOKEN_BASE_MAINNET : USDC_TOKEN_BASE_SEPOLIA);
  const res = await axios.post(
    `${BASE_URL}/developer/transactions/transfer`,
    {
      idempotencyKey: uuidv4(),
      entitySecretCiphertext,
      walletId: userWalletId,
      destinationAddress: process.env.CIRCLE_TREASURY_ADDRESS,
      amounts: ["0.50"],
      tokenAddress: isMainnet ? USDC_TOKEN_BASE_MAINNET : USDC_TOKEN_BASE_SEPOLIA,
      blockchain: isMainnet ? "BASE-MAINNET" : "BASE-SEPOLIA",
      feeLevel: "MEDIUM",
    },
    { headers: headers() }
  );
  console.log("   Transfer response:", JSON.stringify(res.data, null, 2));
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
  const res = await axios.post(
    "https://api.circle.com/v1/faucet/drips",
    { address: walletAddress, blockchain: "BASE-SEPOLIA", native: false, usdc: true },
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
  getTransactionStatus,
  fundTestWallet,
};