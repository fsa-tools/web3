import { encodeFunctionData, type Address } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import { ERC20_ABI } from "../../abis/erc20.js";
import { applySlippage } from "../../math/slippage.js";
import type { TxRequest } from "../../tx/types.js";
import type {
  MintOperationParams,
  DecreaseOperationParams,
  CollectOperationParams,
  BurnOperationParams,
} from "./types.js";

const MAX_UINT128 = 2n ** 128n - 1n;

export type PlanMintParams = MintOperationParams & {
  readonly npmAddress: Address;
  readonly recipient: Address;
  readonly deadline: bigint;
};

function approveTx(
  token: Address,
  spender: Address,
  amount: bigint,
  label: string,
): TxRequest {
  return {
    label,
    to: token,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, amount],
    }),
    value: 0n,
  };
}

export function planMint(params: PlanMintParams): TxRequest[] {
  const amount0Min = applySlippage(params.amount0Desired, params.slippageBps);
  const amount1Min = applySlippage(params.amount1Desired, params.slippageBps);
  const mint: TxRequest = {
    label: "mint Uniswap V3 LP position",
    to: params.npmAddress,
    data: encodeFunctionData({
      abi: NPM_ABI,
      functionName: "mint",
      args: [
        {
          token0: params.token0,
          token1: params.token1,
          fee: params.fee,
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          amount0Desired: params.amount0Desired,
          amount1Desired: params.amount1Desired,
          amount0Min,
          amount1Min,
          recipient: params.recipient,
          deadline: params.deadline,
        },
      ],
    }),
    value: 0n,
  };
  return [
    approveTx(
      params.token0,
      params.npmAddress,
      params.amount0Desired,
      `approve token0 (${params.token0}) → Uniswap V3 NPM`,
    ),
    approveTx(
      params.token1,
      params.npmAddress,
      params.amount1Desired,
      `approve token1 (${params.token1}) → Uniswap V3 NPM`,
    ),
    mint,
  ];
}

export type PlanDecreaseParams = Omit<
  DecreaseOperationParams,
  "slippageBps"
> & {
  readonly npmAddress: Address;
  readonly deadline: bigint;
  readonly amount0Min: bigint;
  readonly amount1Min: bigint;
};

export function planDecreaseLiquidity(params: PlanDecreaseParams): TxRequest[] {
  return [
    {
      label: `decrease Uniswap V3 liquidity (tokenId ${params.tokenId})`,
      to: params.npmAddress,
      data: encodeFunctionData({
        abi: NPM_ABI,
        functionName: "decreaseLiquidity",
        args: [
          {
            tokenId: params.tokenId,
            liquidity: params.liquidity,
            amount0Min: params.amount0Min,
            amount1Min: params.amount1Min,
            deadline: params.deadline,
          },
        ],
      }),
      value: 0n,
    },
  ];
}

export type PlanCollectParams = CollectOperationParams & {
  readonly npmAddress: Address;
};

export function planCollectFees(params: PlanCollectParams): TxRequest[] {
  return [
    {
      label: `collect Uniswap V3 fees (tokenId ${params.tokenId})`,
      to: params.npmAddress,
      data: encodeFunctionData({
        abi: NPM_ABI,
        functionName: "collect",
        args: [
          {
            tokenId: params.tokenId,
            recipient: params.recipient,
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128,
          },
        ],
      }),
      value: 0n,
    },
  ];
}

export type PlanBurnParams = BurnOperationParams & {
  readonly npmAddress: Address;
};

export function planBurnPosition(params: PlanBurnParams): TxRequest[] {
  return [
    {
      label: `burn Uniswap V3 position NFT (tokenId ${params.tokenId})`,
      to: params.npmAddress,
      data: encodeFunctionData({
        abi: NPM_ABI,
        functionName: "burn",
        args: [params.tokenId],
      }),
      value: 0n,
    },
  ];
}
