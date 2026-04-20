import { ERC20_ABI } from "../../abis/erc20.js";
import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import type {
  GetPositionValueOperationParams,
  GetUserAccountDataOperationParams,
  PositionValue,
  AccountData,
} from "./types.js";

export async function getPositionValue(
  ctx: ChainContext,
  params: GetPositionValueOperationParams,
): Promise<PositionValue> {
  const { publicClient } = ctx;

  const balance = (await publicClient.readContract({
    address: params.aTokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [params.owner],
  })) as bigint;

  const decimals = (await publicClient.readContract({
    address: params.aTokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
    args: [],
  })) as number;

  return { balance, decimals };
}

export async function getUserAccountData(
  ctx: ChainContext,
  params: GetUserAccountDataOperationParams,
): Promise<AccountData> {
  if (!ctx.addresses.aave) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "aave",
    );
  }

  const result = (await ctx.publicClient.readContract({
    address: ctx.addresses.aave.pool,
    abi: AAVE_POOL_ABI,
    functionName: "getUserAccountData",
    args: [params.user],
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
