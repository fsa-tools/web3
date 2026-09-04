import type { Hex } from "viem";
import { createChainContext } from "../../src/context.js";
import type { ChainContext } from "../../src/context.js";

export type SmokeChainConfig = {
  chainId: number;
  name: string;
  rpcEnvVar: string;
  pkEnvVar: string;
  faucetTokens: {
    weth?: `0x${string}`;
    usdc?: `0x${string}`;
  };
  aaveReserves?: {
    weth?: `0x${string}`;
    usdc?: `0x${string}`;
  };
};

export const SMOKE_CHAINS: Record<string, SmokeChainConfig> = {
  sepolia: {
    chainId: 11155111,
    name: "sepolia",
    rpcEnvVar: "SEPOLIA_RPC",
    pkEnvVar: "SMOKE_PK_SEPOLIA",
    faucetTokens: {
      weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    },
    aaveReserves: {
      usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    },
  },
  polygonAmoy: {
    chainId: 80002,
    name: "polygon-amoy",
    rpcEnvVar: "POLYGON_AMOY_RPC",
    pkEnvVar: "SMOKE_PK_POLYGON",
    faucetTokens: {
      weth: "0x52eF3d68BaB452a294342DC3e5f464d7f610f72E",
      usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    },
  },
};

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export function loadChainContext(cfg: SmokeChainConfig): ChainContext | null {
  const rpcRaw = process.env[cfg.rpcEnvVar];
  const pk = process.env[cfg.pkEnvVar];
  if (!rpcRaw || !pk) return null;

  const rpcUrls = rpcRaw.split(",").map((u) => u.trim());
  return createChainContext({
    chainId: cfg.chainId,
    rpcUrls,
    privateKey: pk as Hex,
  });
}

export type ReadOnlyChainConfig = {
  chainId: number;
  name: string;
  rpcEnvVar: string;
  tokens: {
    usdc: `0x${string}`;
    weth: `0x${string}`;
  };
};

/**
 * Base mainnet, só leitura — detecção de permit não assina nada.
 * Deliberadamente FORA de `SMOKE_CHAINS`: aquele registry é varrido pelos
 * smokes transacionais (aave, pool, utils), e Base é mainnet — uma entrada lá
 * poria fundos reais em risco.
 */
export const PERMIT_READONLY_CHAINS: Record<string, ReadOnlyChainConfig> = {
  base: {
    chainId: 8453,
    name: "base",
    rpcEnvVar: "BASE_RPC",
    tokens: {
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      weth: "0x4200000000000000000000000000000000000006",
    },
  },
};

/** Contexto sem walletClient — só precisa do RPC, nunca de private key. */
export function loadReadOnlyChainContext(
  cfg: ReadOnlyChainConfig,
): ChainContext | null {
  const rpcRaw = process.env[cfg.rpcEnvVar];
  if (!rpcRaw) return null;

  const rpcUrls = rpcRaw.split(",").map((u) => u.trim());
  return createChainContext({ chainId: cfg.chainId, rpcUrls });
}
