require("dotenv").config();

console.log("\n📋 Environment check:");
console.log("   CIRCLE_API_KEY:", process.env.CIRCLE_API_KEY ? process.env.CIRCLE_API_KEY.slice(0,20) + "..." : "MISSING");
console.log("   ENTITY_SECRET:", process.env.ENTITY_SECRET ? process.env.ENTITY_SECRET.slice(0,10) + "... (" + process.env.ENTITY_SECRET.length + " chars)" : "MISSING ⚠️");
console.log("   CIRCLE_WALLET_SET_ID:", process.env.CIRCLE_WALLET_SET_ID || "empty (will be filled)");
console.log("");

const { createWalletSet, createTreasuryWallet } = require("./circle");

async function setup() {
  console.log("🔧 SocialMint — Circle Wallet Setup\n");

  console.log("Step 1: Creating Wallet Set...");
  let walletSet;
  if (process.env.CIRCLE_WALLET_SET_ID) {
    console.log("  ✅ Already set:", process.env.CIRCLE_WALLET_SET_ID);
    walletSet = { id: process.env.CIRCLE_WALLET_SET_ID };
  } else {
    walletSet = await createWalletSet("SocialMint Agent");
    console.log("  ✅ Created:", walletSet.id);
  }

  console.log("\nStep 2: Creating Treasury Wallet...");
  if (process.env.CIRCLE_TREASURY_WALLET_ID) {
    console.log("  ✅ Already set:", process.env.CIRCLE_TREASURY_WALLET_ID);
    console.log("  Address:", process.env.CIRCLE_TREASURY_ADDRESS);
  } else {
    const treasury = await createTreasuryWallet();
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 ADD THESE TO YOUR .env FILE:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`CIRCLE_WALLET_SET_ID=${walletSet.id}`);
    console.log(`CIRCLE_TREASURY_WALLET_ID=${treasury.id}`);
    console.log(`CIRCLE_TREASURY_ADDRESS=${treasury.address}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  console.log("✅ Setup complete! Now run: node server.js\n");
}

setup().catch(err => {
  console.error("\n❌ Setup failed:", err.message);
  if (err.response?.data) {
    console.error("Circle API error:", JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});