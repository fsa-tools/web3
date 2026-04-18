import type { Hex } from "viem";

export type SmokeChainConfig = {
  chainId: number;
  name: string;
  rpcEnvVar: string;
  pkEnvVar: string;
  faucetTokens: {
    // Endereços de tokens de faucet conhecidos por testnet
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
  arbitrumSepolia: {
    chainId: 421614,
    name: "arbitrum-sepolia",
    rpcEnvVar: "ARBITRUM_SEPOLIA_RPC",
    pkEnvVar: "SMOKE_PK_ARBITRUM",
    faucetTokens: {
      // WETH Sepolia Arbitrum
      weth: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
      // USDC faucet Arbitrum Sepolia
      usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    },
    protocols: {
      uniswapV3Npm: "0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65",
      aavePool: "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff",
    },
  },
  baseSepolia: {
    chainId: 84532,
    name: "base-sepolia",
    rpcEnvVar: "BASE_SEPOLIA_RPC",
    pkEnvVar: "SMOKE_PK_BASE",
    faucetTokens: {
      weth: "0x4200000000000000000000000000000000000006",
      usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    },
    protocols: {
      uniswapV3Npm: "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
      aerodromeNpm: "0x827922686190790b37229fd06084350E74485b72",
    },
  },
  polygonAmoy: {
    chainId: 80002,
    name: "polygon-amoy",
    rpcEnvVar: "POLYGON_AMOY_RPC",
    pkEnvVar: "SMOKE_PK_POLYGON",
    faucetTokens: {
      weth: "0x52eF3d68BaB452a294342DC3e5f464d7f610f72E",
      usdc: "0x41e94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
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
