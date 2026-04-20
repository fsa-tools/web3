import type { Address, Hash } from "viem";
import { ERC20_ABI } from "../abis/erc20.js";
import type { ChainContext } from "../context.js";
import { validateAddress } from "./address.js";

const MAX_UINT256 = 2n ** 256n - 1n;

export type EnsureAllowanceParams = {
  token: Address;
  spender: Address;
  amount: bigint;
};

export type AllowanceResult = {
  approved: boolean;
  txHash?: Hash;
};

export type GetBalanceParams = {
  token: Address;
  owner: Address;
};

export async function ensureAllowance(
  ctx: ChainContext,
  params: EnsureAllowanceParams,
): Promise<AllowanceResult> {
  if (!ctx.walletClient) {
    throw new Error("ensureAllowance requires walletClient in ChainContext");
  }
  const { publicClient, walletClient } = ctx;
  const { token, spender, amount } = params;
  validateAddress(token);
  validateAddress(spender);
  if (amount === 0n) {
    return { approved: false };
  }
  const currentAllowance = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [walletClient.account.address, spender],
  })) as bigint;
  if (currentAllowance >= amount) {
    return { approved: false };
  }
  if (currentAllowance > 0n) {
    const resetHash = await walletClient.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, 0n],
    });
    await publicClient.waitForTransactionReceipt({
      hash: resetHash,
      confirmations: 2,
    });
  }
  const txHash = await walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, MAX_UINT256],
  });
  return { approved: true, txHash };
}

export async function getBalance(
  ctx: ChainContext,
  params: GetBalanceParams,
): Promise<bigint> {
  return (await ctx.publicClient.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [params.owner],
  })) as bigint;
}
