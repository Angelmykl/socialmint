require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "./backend/.env" });

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    arc: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: process.env.AGENT_PRIVATE_KEY ? [process.env.AGENT_PRIVATE_KEY] : [],
    }
  }
};