const hre = require("hardhat");
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  const F = await hre.ethers.getContractFactory("PredictionAgent");
  const c = await F.deploy(deployer.address);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("✅ Contract deployed to:", addr);
}
main().catch(e => { console.error(e); process.exitCode = 1; });