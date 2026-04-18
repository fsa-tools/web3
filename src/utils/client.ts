import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  base,
  mainnet,
  optimism,
  arbitrum,
  polygon,
  sepolia,
  polygonAmoy,
} from "viem/chains";

export type CreateClientsParams = {
  chainId: number;
  rpcUrl: string | string[];
  privateKey?: Hex;
};

export type ClientPair = {
  publicClient: PublicClient;
  walletClient?: WalletClient<Transport, Chain, Account>;
};

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  8453: base,
  42161: arbitrum,
  137: polygon,
  11155111: sepolia,
  80002: polygonAmoy,
};

export function createClients(params: CreateClientsParams): ClientPair {
  const chain = CHAIN_MAP[params.chainId];
  if (!chain) {
    throw new Error(`Unsupported chainId: ${params.chainId}`);
  }
  const transport = Array.isArray(params.rpcUrl)
    ? fallback(
        params.rpcUrl.map((url) => http(url)),
        { rank: true, retryCount: 1 },
      )
    : http(params.rpcUrl);
  const publicClient = createPublicClient({ chain, transport }) as PublicClient;
  const walletClient = params.privateKey
    ? createWalletClient({
        chain,
        transport,
        account: privateKeyToAccount(params.privateKey),
      })
    : undefined;
  return { publicClient, walletClient };
}
