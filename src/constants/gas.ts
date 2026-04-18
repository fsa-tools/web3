export const EXPECTED_GAS_UNITS = {
  // Uniswap V3
  uniswapV3Mint: 400000n,
  uniswapV3Exit: 300000n,
  uniswapV3Collect: 200000n,
  uniswapV3Burn: 100000n,
  // Aerodrome
  aerodromeMint: 350000n,
  aerodromeExit: 300000n,
  aerodromeCollect: 200000n,
  aerodromeBurn: 100000n,
  // Aave
  aaveSupply: 250000n,
  aaveWithdraw: 250000n,
} as const;

export type GasOperation = keyof typeof EXPECTED_GAS_UNITS;
