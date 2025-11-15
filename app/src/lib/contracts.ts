import { hardhat } from 'wagmi/chains';
import type { Abi } from 'viem';

// Import ABI and deployment info from the web3 project
import counterArtifact from '../../../web3/ignition/deployments/chain-31337/artifacts/CounterModule#Counter.json';
import deployedAddresses from '../../../web3/ignition/deployments/chain-31337/deployed_addresses.json';

/**
 * Counter Contract Configuration
 * Imports directly from Hardhat deployment artifacts
 */

// Contract ABI from deployment artifacts
export const counterABI = counterArtifact.abi as Abi;

// Contract deployment addresses per chain
export const counterAddress = {
  [hardhat.id]: deployedAddresses['CounterModule#Counter'] as `0x${string}`,
} as const;

// Default chain for the app
export const defaultChain = hardhat;

// Helper to get contract address for current chain
export function getCounterAddress(chainId: number): `0x${string}` | undefined {
  return counterAddress[chainId as keyof typeof counterAddress];
}
