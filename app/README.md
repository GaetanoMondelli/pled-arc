# Web3 Hackathon - Next.js App

Next.js frontend application for interacting with Hardhat smart contracts.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env.local
```

3. Deploy the Counter contract (from ../web3):
```bash
cd ../web3
npx hardhat node
# In another terminal:
npx hardhat ignition deploy ignition/modules/CounterModule.ts --network localhost
```

4. Copy the deployed contract address to `.env.local`:
```bash
NEXT_PUBLIC_COUNTER_ADDRESS=0x... # Address from deployment
```

5. Run the dev server:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                  # Next.js app router pages
│   ├── layout.tsx       # Root layout with providers
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── components/          # React components
│   ├── providers.tsx    # Wagmi + React Query providers
│   └── counter-display.tsx  # Counter contract UI
└── lib/                 # Utilities
    ├── wagmi.ts         # Wagmi configuration
    └── utils.ts         # Helper functions
```

## Tech Stack

- **Framework**: Next.js 15.5.4 with App Router
- **React**: 19.1.0
- **Web3**: Wagmi 2.x + Viem 2.x
- **Styling**: Tailwind CSS + Radix UI + DaisyUI
- **State**: Zustand
- **Animations**: Framer Motion + GSAP

## Web3 Integration

### Reading Contract State

```tsx
import { useReadContract } from 'wagmi';

const { data } = useReadContract({
  address: '0x...',
  abi: contractABI,
  functionName: 'functionName',
});
```

### Writing to Contract

```tsx
import { useWriteContract } from 'wagmi';

const { writeContract } = useWriteContract();

writeContract({
  address: '0x...',
  abi: contractABI,
  functionName: 'functionName',
  args: [arg1, arg2],
});
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Notes

- TypeScript errors are ignored in builds (hackathon mode)
- ESLint is disabled during builds
- Webpack configured for Web3 compatibility
- Ready for existing component imports
