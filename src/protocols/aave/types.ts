import type { Address, Hash } from "viem";

export type SupplyOperationParams = {
  asset: Address;
  amount: bigint;
  onBehalfOf?: Address;
};

export type SupplyResult = {
  txHash: Hash;
};

export type WithdrawOperationParams = {
  asset: Address;
  amount: bigint;
  to?: Address;
};

export type WithdrawResult = {
  txHash: Hash;
  amount: bigint;
};

export type GetPositionValueOperationParams = {
  aTokenAddress: Address;
  owner: Address;
};

export type PositionValue = {
  balance: bigint;
  decimals: number;
};

export type GetUserAccountDataOperationParams = {
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
