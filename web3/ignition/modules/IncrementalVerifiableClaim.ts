import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deployment module for IncrementalVerifiableClaim contract
 *
 * This deploys the contract to Arc Testnet for the hackathon demo.
 *
 * Usage:
 *   npx hardhat ignition deploy ignition/modules/IncrementalVerifiableClaim.ts --network arc-testnet
 *
 * After deployment, save the contract address to your .env file:
 *   INCREMENTAL_CLAIM_CONTRACT_ADDRESS=0x...
 */
const IncrementalVerifiableClaimModule = buildModule("IncrementalVerifiableClaimModule", (m) => {
  // Deploy the contract
  const claim = m.contract("IncrementalVerifiableClaim");

  return { claim };
});

export default IncrementalVerifiableClaimModule;
