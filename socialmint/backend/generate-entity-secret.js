require("dotenv").config();
const axios = require("axios");
const forge = require("node-forge");
const crypto = require("crypto");

async function main() {
  console.log("\n🔐 Generating Entity Secret for Circle...\n");

  const entitySecret = crypto.randomBytes(32).toString("hex");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1️⃣  ADD THIS TO YOUR .env file:");
  console.log(`ENTITY_SECRET=${entitySecret}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("⏳ Fetching Circle public key...");
  const res = await axios.get(
    "https://api.circle.com/v1/w3s/config/entity/publicKey",
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CIRCLE_API_KEY}` } }
  );
  const publicKeyPem = res.data.data.publicKey;
  console.log("✅ Got public key\n");

  const publicKey   = forge.pki.publicKeyFromPem(publicKeyPem);
  const secretBytes = forge.util.hexToBytes(entitySecret);
  const encrypted   = publicKey.encrypt(secretBytes, "RSA-OAEP", { md: forge.md.sha256.create() });
  const ciphertext  = forge.util.encode64(encrypted);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("2️⃣  PASTE THIS INTO Circle Console (684-char field):");
  console.log(`Characters: ${ciphertext.length}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(ciphertext);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("✅ Done! Now run: node setup.js");
}

main().catch(e => console.error("❌", e.response?.data || e.message));