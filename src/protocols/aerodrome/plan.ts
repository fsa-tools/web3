import { encodeFunctionData, type Address } from "viem";
import { AERODROME_NPM_ABI } from "../../abis/aerodrome-npm.js";
import { AERODROME_SWAP_ROUTER_ABI } from "../../abis/aerodrome-swap-router.js";
import { ERC20_ABI } from "../../abis/erc20.js";
import { applySlippage } from "../../math/slippage.js";
import type { TxRequest } from "../../tx/types.js";
import type {
  MintOperationParams,
  DecreaseOperationParams,
  CollectOperationParams,
  BurnOperationParams,
  SwapOperationParams,
} from "./types.js";

const MAX_UINT128 = 2n ** 128n - 1n;

export type PlanMintParams = MintOperationParams & {
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
    label: "mint Aerodrome LP position",
    to: params.npmAddress,
    data: encodeFunctionData({
      abi: AERODROME_NPM_ABI,
      functionName: "mint",
      args: [
        {
          token0: params.token0,
          token1: params.token1,
          tickSpacing: params.tickSpacing,
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          amount0Desired: params.amount0Desired,
          amount1Desired: params.amount1Desired,
          amount0Min,
          amount1Min,
          recipient: params.recipient,
          deadline: params.deadline,
          sqrtPriceX96: params.sqrtPriceX96,
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
      `approve token0 (${params.token0}) → Aerodrome NPM`,
    ),
    approveTx(
      params.token1,
      params.npmAddress,
      params.amount1Desired,
      `approve token1 (${params.token1}) → Aerodrome NPM`,
    ),
    mint,
  ];
}

export type PlanDecreaseParams = Omit<
  DecreaseOperationParams,
  "amount0Min" | "amount1Min" | "deadline" | "gasOptions"
> & {
  readonly deadline: bigint;
  readonly amount0Min: bigint;
  readonly amount1Min: bigint;
};

export function planDecreaseLiquidity(params: PlanDecreaseParams): TxRequest[] {
  return [
    {
      label: `decrease Aerodrome liquidity (tokenId ${params.nftId})`,
      to: params.npmAddress,
      data: encodeFunctionData({
        abi: AERODROME_NPM_ABI,
        functionName: "decreaseLiquidity",
        args: [
          {
            tokenId: params.nftId,
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
  readonly recipient: Address;
};

export function planCollectFees(params: PlanCollectParams): TxRequest[] {
  return [
    {
      label: `collect Aerodrome fees (tokenId ${params.nftId})`,
      to: params.npmAddress,
      data: encodeFunctionData({
        abi: AERODROME_NPM_ABI,
        functionName: "collect",
        args: [
          {
            tokenId: params.nftId,
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

export type PlanBurnParams = BurnOperationParams;

export function planBurnPosition(params: PlanBurnParams): TxRequest[] {
  return [
    {
      label: `burn Aerodrome position NFT (tokenId ${params.nftId})`,
      to: params.npmAddress,
      data: encodeFunctionData({
        abi: AERODROME_NPM_ABI,
        functionName: "burn",
        args: [params.nftId],
      }),
      value: 0n,
    },
  ];
}

export type PlanSwapParams = Omit<
  SwapOperationParams,
  "slippageBps" | "deadline" | "gasOptions"
> & {
  readonly routerAddress: Address;
  readonly recipient: Address;
  readonly amountOutMinimum: bigint;
  readonly deadline: bigint;
};

export function planSwapExactInputSingle(params: PlanSwapParams): TxRequest[] {
  const {
    tokenIn,
    tokenOut,
    tickSpacing,
    amountIn,
    amountOutMinimum,
    routerAddress,
    recipient,
    deadline,
  } = params;
  const swap: TxRequest = {
    label: `swap exactInputSingle ${tokenIn} → ${tokenOut} via Aerodrome Slipstream`,
    to: routerAddress,
    data: encodeFunctionData({
      abi: AERODROME_SWAP_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          tickSpacing,
          recipient,
          deadline,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        },
      ],
    }),
    value: 0n,
  };
  return [
    approveTx(
      tokenIn,
      routerAddress,
      amountIn,
      `approve tokenIn (${tokenIn}) → Aerodrome SwapRouter`,
    ),
    swap,
  ];
}
