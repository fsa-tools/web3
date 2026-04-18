import type {
  Address,
  Hash,
  WalletClient,
  PublicClient,
  Transport,
  Chain,
  Account,
} from "viem";

export type SupplyParams = {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  chainId: number;
  asset: Address;
  amount: bigint;
  onBehalfOf?: Address;
};

export type SupplyResult = {
  txHash: Hash;
};

export type WithdrawParams = {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  chainId: number;
  asset: Address;
  amount: bigint;
  to?: Address;
};

export type WithdrawResult = {
  txHash: Hash;
  amount: bigint;
};

export type GetPositionValueParams = {
  publicClient: PublicClient;
  aTokenAddress: Address;
  owner: Address;
};

export type PositionValue = {
  balance: bigint;
  decimals: number;
};

export type GetUserAccountDataParams = {
  publicClient: PublicClient;
  chainId: number;
  user: Address;
};

export type AccountData = {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
};
