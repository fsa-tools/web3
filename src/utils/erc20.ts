import type { Address, Hash, TransactionReceipt } from "viem";
import { ERC20_ABI } from "../abis/erc20.js";
import type { ChainContext } from "../context.js";
import { validateAddress } from "./address.js";

const MAX_UINT256 = 2n ** 256n - 1n;

export type ApprovalMode = "exact" | "unlimited";

export type EnsureAllowanceParams = {
  token: Address;
  spender: Address;
  amount: bigint;
  approvalMode?: ApprovalMode;
};

export type AllowanceResult = {
  approved: boolean;
  txHash?: Hash;
  receipts: TransactionReceipt[];
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
    return { approved: false, receipts: [] };
  }
  const currentAllowance = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [walletClient.account.address, spender],
  });
  if (currentAllowance >= amount) {
    return { approved: false, receipts: [] };
  }
  const receipts: TransactionReceipt[] = [];
  if (currentAllowance > 0n) {
    const resetHash = await walletClient.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, 0n],
    });
    const resetReceipt = await publicClient.waitForTransactionReceipt({
      hash: resetHash,
      confirmations: 2,
    });
    receipts.push(resetReceipt);
  }
  const approveAmount =
    (params.approvalMode ?? "unlimited") === "exact" ? amount : MAX_UINT256;
  const txHash = await walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, approveAmount],
  });
  const finalReceipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  receipts.push(finalReceipt);
  return { approved: true, txHash, receipts };
}

export async function getBalance(
  ctx: ChainContext,
  params: GetBalanceParams,
): Promise<bigint> {
  return await ctx.publicClient.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [params.owner],
  });
}
