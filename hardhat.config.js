import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY?.trim();

export default {
  solidity: "0.8.19",

  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};