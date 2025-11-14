'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { WagmiProvider } from 'wagmi';
// import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
// import { hardhat } from 'wagmi/chains';
// import { config } from '@/lib/wagmi';
import { useState } from 'react';
// import '@rainbow-me/rainbowkit/styles.css';

// Wagmi/Hardhat disabled - using Arc Testnet with Circle SDK instead
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
    // <WagmiProvider config={config}>
    //   <QueryClientProvider client={queryClient}>
    //     <RainbowKitProvider initialChain={hardhat}>
    //       {children}
    //     </RainbowKitProvider>
    //   </QueryClientProvider>
    // </WagmiProvider>
  );
}
