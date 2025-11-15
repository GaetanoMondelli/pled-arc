#!/bin/bash
cd /Users/gaetano/dev/archackathon/web3
export ARC_TESTNET_PRIVATE_KEY=0x52cf5dca72301d3069035a60ead072454a8c80db2873ea0ed08c607a56fe0f3d
(echo y; sleep 1; echo y) | npx hardhat ignition deploy ./ignition/modules/IncrementalVerifiableClaim.ts --network arcTestnet --reset
