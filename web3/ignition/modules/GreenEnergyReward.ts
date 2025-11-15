import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Arc Testnet USDC address (native USDC)
const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

// Claim contract address - should be set in your .env
const CLAIM_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_INCREMENTAL_CLAIM_CONTRACT_ADDRESS || "0xa31c26368B181F02Cbf463cee7a67c16b003fA2d";

const GreenEnergyRewardModule = buildModule("GreenEnergyRewardModule", (m) => {
  // Get constructor parameters
  const usdcAddress = m.getParameter("usdcAddress", ARC_USDC_ADDRESS);
  const claimContract = m.getParameter("claimContract", CLAIM_CONTRACT_ADDRESS);

  // Deploy the contract
  const greenEnergyReward = m.contract("GreenEnergyReward", [usdcAddress, claimContract]);

  return { greenEnergyReward };
});

export default GreenEnergyRewardModule;
