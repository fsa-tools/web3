export type ChainConfig = {
  id: number;
  name: string;
};

// NOTE: not all chains here have entries in ADDRESSES (e.g. 56, 146 have no protocol support yet).
export const CHAINS = {
  1: { id: 1, name: "ethereum" },
  10: { id: 10, name: "optimism" },
  56: { id: 56, name: "bnb" },
  146: { id: 146, name: "sonic" },
  8453: { id: 8453, name: "base" },
  42161: { id: 42161, name: "arbitrum" },
  137: { id: 137, name: "polygon" },
} as const;

export type ChainId = keyof typeof CHAINS;

export function toChainName(chainId: number): string | undefined {
  const chain = (CHAINS as Record<number, ChainConfig>)[chainId];
  return chain?.name;
}

export function toChainId(name: string): ChainId | undefined {
  const lower = name.toLowerCase();
  const entry = Object.entries(CHAINS).find(([, v]) => v.name === lower);
  return entry ? (Number(entry[0]) as ChainId) : undefined;
}
