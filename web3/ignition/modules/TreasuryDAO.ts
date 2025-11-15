import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deployment module for TreasuryDAOPermissionless contract
 *
 * This deploys the permissionless treasury contract to Arc Testnet for the hackathon demo.
 * The contract manages share-based profit distribution for Web3 Scion Limited.
 *
 * Usage:
 *   export ARC_TESTNET_PRIVATE_KEY=0x...
 *   npx hardhat ignition deploy ./ignition/modules/TreasuryDAO.ts --network arcTestnet
 *
 * After deployment, save the contract address to your .env file:
 *   NEXT_PUBLIC_TREASURY_DAO_ADDRESS=0x...
 */
const TreasuryDAOModule = buildModule("TreasuryDAOModule", (m) => {
  // USDC address on Arc Testnet
  const usdcAddress = "0x3600000000000000000000000000000000000000";

  // Deploy the contract with USDC address as constructor parameter
  const treasury = m.contract("TreasuryDAOPermissionless", [usdcAddress]);

  // Officer addresses for initialization
  const michaelBurry = "0x5a79daf48e3b02e62bdaf8554b50083617f4a359";
  const richardBranson = "0x43d1ae3ba36d2f7f3f882db552eb5f9d10dddc37";
  const cathieWood = "0x3c4b268b88ca7374e2f597b6627011225263d8b4";

  // Initialize shares: Michael 50%, Richard 30%, Cathie 20%
  m.call(treasury, "initializeShares", [
    [michaelBurry, richardBranson, cathieWood],
    [50, 30, 20],
  ]);

  return { treasury };
});

export default TreasuryDAOModule;
