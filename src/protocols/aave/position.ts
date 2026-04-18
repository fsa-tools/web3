import { ERC20_ABI } from "../../abis/erc20.js";
import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import { ADDRESSES } from "../../constants/addresses.js";
import type {
  GetPositionValueParams,
  PositionValue,
  GetUserAccountDataParams,
  AccountData,
} from "./types.js";

export async function getPositionValue(
  params: GetPositionValueParams,
): Promise<PositionValue> {
  const { publicClient, aTokenAddress, owner } = params;

  const balance = (await publicClient.readContract({
    address: aTokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;

  const decimals = (await publicClient.readContract({
    address: aTokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
    args: [],
  })) as number;

  return { balance, decimals };
}

export async function getUserAccountData(
  params: GetUserAccountDataParams,
): Promise<AccountData> {
  const { publicClient, chainId, user } = params;

  const chainAddrs = ADDRESSES[chainId];
  if (!chainAddrs?.aave) {
    throw new Error(`chainId ${chainId} is not supported for Aave`);
  }

  const result = (await publicClient.readContract({
    address: chainAddrs.aave.pool,
    abi: AAVE_POOL_ABI,
    functionName: "getUserAccountData",
    args: [user],
  })) as [bigint, bigint, bigint, bigint, bigint, bigint];

  return {
    totalCollateralBase: result[0],
    totalDebtBase: result[1],
    availableBorrowsBase: result[2],
    currentLiquidationThreshold: result[3],
    ltv: result[4],
    healthFactor: result[5],
  };
}
