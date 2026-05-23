import { encodeFunctionData, type Address } from "viem";
import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import { ERC20_ABI } from "../../abis/erc20.js";
import type { TxRequest } from "../../tx/types.js";
import type {
  SupplyOperationParams,
  WithdrawOperationParams,
  RepayOperationParams,
} from "./types.js";

const AAVE_REFERRAL_CODE = 0;

export type PlanSupplyParams = SupplyOperationParams & {
  readonly poolAddress: Address;
  readonly onBehalfOf: Address;
};

export function planSupply(params: PlanSupplyParams): TxRequest[] {
  return [
    {
      label: `approve ${params.asset} → Aave Pool`,
      to: params.asset,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [params.poolAddress, params.amount],
      }),
      value: 0n,
    },
    {
      label: "supply to Aave V3",
      to: params.poolAddress,
      data: encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "supply",
        args: [
          params.asset,
          params.amount,
          params.onBehalfOf,
          AAVE_REFERRAL_CODE,
        ],
      }),
      value: 0n,
    },
  ];
}

export type PlanWithdrawParams = WithdrawOperationParams & {
  readonly poolAddress: Address;
  readonly to: Address;
};

export function planWithdraw(params: PlanWithdrawParams): TxRequest[] {
  return [
    {
      label: "withdraw from Aave V3",
      to: params.poolAddress,
      data: encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "withdraw",
        args: [params.asset, params.amount, params.to],
      }),
      value: 0n,
    },
  ];
}

export type PlanRepayParams = RepayOperationParams & {
  readonly poolAddress: Address;
  readonly onBehalfOf: Address;
};

export function planRepay(params: PlanRepayParams): TxRequest[] {
  return [
    {
      label: `approve ${params.asset} → Aave Pool (repay)`,
      to: params.asset,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [params.poolAddress, params.amount],
      }),
      value: 0n,
    },
    {
      label: "repay to Aave V3",
      to: params.poolAddress,
      data: encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "repay",
        args: [
          params.asset,
          params.amount,
          BigInt(params.interestRateMode),
          params.onBehalfOf,
        ],
      }),
      value: 0n,
    },
  ];
}
