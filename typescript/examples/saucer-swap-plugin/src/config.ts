import { LedgerId } from "@hashgraph/sdk";

export const saucerSwapConfig = {
  networks: {
    [LedgerId.MAINNET.toString()]: {
      router: "0x00000000000000000000000000000000003c437a", // TODO: Get from SaucerSwap docs or GitHub
      factory: "0x0000000000000000000000000000000000000000", // TODO: Get from SaucerSwap docs or GitHub
      wrappedHBAR: "0x0000000000000000000000000000000000163b5a", // TODO: Get from SaucerSwap docs or GitHub
      quoter: "0x00000000000000000000000000000000003c4370", // TODO: Get from SaucerSwap docs or GitHub
      defaultFeeTiersBps: [25, 30, 100], // TODO: Verify with SaucerSwap docs

      // write a config to store pools tokenIn, tokenOut and feeTierBps
      pools: [
        {
          tokenA: "0x0000000000000000000000000000000000000000",
          tokenB: "0x0000000000000000000000000000000000000000",
          feeTierBps: 25,
        },
        {
          tokenA: "0x0000000000000000000000000000000000163b5a",
          tokenB: "0x00000000000000000000000000000000000b2ad5",
          feeTierBps: 3000,
        },
        {
          tokenA: "0x0000000000000000000000000000000000163b5a",
          tokenB: "0x00000000000000000000000000000000000d1ea6",
          feeTierBps: 30,
        },
      ],
    },
    [LedgerId.TESTNET.toString()]: {
      router: "0x0000000000000000000000000000000000000000", // TODO: Get from SaucerSwap docs or GitHub
      factory: "0x0000000000000000000000000000000000000000", // TODO: Get from SaucerSwap docs or GitHub
      wrappedHBAR: "0x0000000000000000000000000000000000000000", // TODO: Get from SaucerSwap docs or GitHub
      quoter: "0x0000000000000000000000000000000000000000", // TODO: Get from SaucerSwap docs or GitHub
      defaultFeeTiersBps: [25, 30, 100], // TODO: Verify with SaucerSwap docs
    },
  },
  defaultSlippageBps: 50, // 0.50%
  defaultQuoteDeadlineSeconds: 600,
} as const;

// NOTE: To get the actual contract addresses:
// 1. Check SaucerSwap documentation: https://docs.saucerswap.finance/home
// 2. Look for SaucerSwap GitHub repository for deployment addresses
// 3. Check Hedera ecosystem documentation for verified contract addresses
// 4. Contact SaucerSwap team for official contract addresses

export type SaucerSwapConfig = typeof saucerSwapConfig;
