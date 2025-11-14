'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId } from 'wagmi';
import { useState, useEffect } from 'react';
import { hardhat } from 'wagmi/chains';
import { counterABI } from '@/lib/contracts';

interface CounterDisplayProps {
  contractAddress: `0x${string}`;
}

export function CounterDisplay({ contractAddress }: CounterDisplayProps) {
  const [mounted, setMounted] = useState(false);
  const chainId = useChainId();
  const { isConnected } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Read the counter value
  const { data: counterValue, refetch, isLoading, error } = useReadContract({
    address: contractAddress,
    abi: counterABI,
    functionName: 'x',
    chainId: hardhat.id,
  });

  // Write contract - increment
  const { writeContract, data: hash, isPending } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Refetch counter value after successful transaction
  useEffect(() => {
    if (isSuccess) {
      refetch();
    }
  }, [isSuccess, refetch]);

  const handleIncrement = () => {
    writeContract({
      address: contractAddress,
      abi: counterABI,
      functionName: 'inc',
      chainId: hardhat.id,
    });
  };

  if (!mounted) return null;

  // Check if connected to wrong chain
  if (isConnected && chainId !== hardhat.id) {
    return (
      <div className="p-4 border border-yellow-500 rounded-lg bg-yellow-50">
        <p className="text-yellow-700 font-semibold">⚠️ Wrong Network</p>
        <p className="text-sm text-yellow-600 mt-2">
          Please switch to Hardhat Local Network (Chain ID: {hardhat.id}) in your wallet.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center p-4">Loading counter...</div>;
  }

  if (error) {
    return (
      <div className="p-4 border border-red-500 rounded-lg">
        <p className="text-red-500">Error loading counter:</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg space-y-4">
      <div>
        <h3 className="text-xl font-semibold mb-2">Counter Contract</h3>
        <p className="text-sm text-muted-foreground">
          Address: {contractAddress}
        </p>
      </div>

      <div className="p-4 bg-secondary rounded-md">
        <p className="text-sm text-muted-foreground">Current Value:</p>
        <p className="text-4xl font-bold">{counterValue?.toString() ?? '0'}</p>
      </div>

      <button
        onClick={handleIncrement}
        disabled={isPending || isConfirming}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending || isConfirming ? 'Incrementing...' : 'Increment Counter'}
      </button>

      {isSuccess && (
        <p className="text-sm text-green-600">
          Transaction successful! Hash: {hash?.slice(0, 10)}...
        </p>
      )}
    </div>
  );
}
