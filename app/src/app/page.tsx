'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CounterDisplay } from '@/components/counter-display';
import { counterAddress, defaultChain } from '@/lib/contracts';

export default function Home() {
  const address = counterAddress[defaultChain.id];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Web3 Arc Hackathon App</h1>
          <ConnectButton />
        </div>
        <p className="text-lg mb-4">
          Next.js app with Counter Contract
        </p>

        <div className="mt-8">
          {address ? (
            <CounterDisplay contractAddress={address} />
          ) : (
            <div className="p-4 border border-red-500 rounded">
              <p className="text-red-500">No contract address found for chain {defaultChain.id}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
