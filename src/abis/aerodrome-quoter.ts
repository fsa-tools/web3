/**
 * Aerodrome Slipstream Quoter — `quoteExactInputSingle`.
 *
 * `stateMutability` é marcado como `"view"` propositalmente: a função on-chain
 * é `nonpayable` (reverte internamente no callback do swap para coletar o
 * resultado), mas o Quoter é projetado para ser chamado read-only via
 * `eth_call`. Marcar como `view` permite usar `publicClient.readContract` da
 * viem sem type assertion; em runtime a chamada é um `eth_call` e nada é
 * escrito on-chain.
 */
export const AERODROME_QUOTER_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "tickSpacing", type: "int24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;
