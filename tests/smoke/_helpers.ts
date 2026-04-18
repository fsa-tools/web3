import type { Hex } from "viem";

export type SmokeChainConfig = {
  chainId: number;
  name: string;
  rpcEnvVar: string;
  pkEnvVar: string;
  faucetTokens: {
    weth?: `0x${string}`;
    usdc?: `0x${string}`;
  };
  protocols: {
    uniswapV3Npm?: `0x${string}`;
    uniswapV3Factory?: `0x${string}`;
    aavePool?: `0x${string}`;
    aerodromeNpm?: `0x${string}`;
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
    protocols: {
      uniswapV3Npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      aavePool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
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
    protocols: {
      uniswapV3Npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      aavePool: "0x1758d4e6f68166C4B2d9d0F049F33dEB399Daa1F",
    },
  },
};

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export function loadChainEnv(
  cfg: SmokeChainConfig,
): { rpcUrl: string; pk: Hex } | null {
  const rpcUrl = process.env[cfg.rpcEnvVar];
  const pk = process.env[cfg.pkEnvVar];
  if (!rpcUrl || !pk) return null;
  return { rpcUrl, pk: pk as Hex };
}
