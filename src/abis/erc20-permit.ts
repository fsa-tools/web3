/** Superfície EIP-2612 de um ERC20 — o que a detecção e o typed data leem. */
export const ERC20_PERMIT_ABI = [
  {
    name: "name",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    name: "nonces",
    type: "function",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "DOMAIN_SEPARATOR",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const;
