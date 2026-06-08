// src/context.ts
import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Account,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  polygonAmoy,
  sepolia,
} from "viem/chains";
import { ADDRESSES, type ChainAddresses } from "./constants/addresses.js";
import { ChainNotSupportedError } from "./errors.js";
import { withConcurrencyLimit, withCooldown } from "./utils/rpc-pool.js";

export type RpcOptions = {
  timeoutMs?: number;
  retryCount?: number;
  cooldownMs?: number;
  maxConcurrency?: number;
};

export type ChainContext = {
  publicClient: PublicClient;
  walletClient?: WalletClient<Transport, Chain, Account>;
  addresses: ChainAddresses;
  decimalsCache?: Map<string, number>;
};

export type CreateChainContextParams = {
  chainId: number;
  rpcUrls: string[];
  privateKey?: Hex;
  decimalsCache?: Map<string, number>;
  rpc?: RpcOptions;
};

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  8453: base,
  42161: arbitrum,
  137: polygon,
  11155111: sepolia,
  80002: polygonAmoy,
  421614: arbitrumSepolia,
  84532: baseSepolia,
};

export function createChainContext(
  params: CreateChainContextParams,
): ChainContext {
  const chain = CHAIN_MAP[params.chainId];
  if (!chain) throw new ChainNotSupportedError(params.chainId);

  const addresses = ADDRESSES[params.chainId];
  if (!addresses) throw new ChainNotSupportedError(params.chainId);

  const rpc = params.rpc;
  const httpOptions =
    rpc && (rpc.timeoutMs !== undefined || rpc.retryCount !== undefined)
      ? { timeout: rpc.timeoutMs, retryCount: rpc.retryCount }
      : undefined;
  const providers = params.rpcUrls.map((url) => {
    const base = httpOptions ? http(url, httpOptions) : http(url);
    return rpc?.cooldownMs ? withCooldown(base, rpc.cooldownMs) : base;
  });
  const ranked = fallback(providers, { rank: true, retryCount: 1 });
  const transport = rpc?.maxConcurrency
    ? withConcurrencyLimit(ranked, rpc.maxConcurrency)
    : ranked;

  const publicClient = createPublicClient({ chain, transport }) as PublicClient;

  const walletClient = params.privateKey
    ? createWalletClient({
        chain,
        transport,
        account: privateKeyToAccount(params.privateKey),
      })
    : undefined;

  return {
    publicClient,
    walletClient,
    addresses,
    decimalsCache: params.decimalsCache,
  };
}
