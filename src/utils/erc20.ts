import type {
  Address,
  Hash,
  PublicClient,
  WalletClient,
  Transport,
  Chain,
  Account,
} from "viem";
import { ERC20_ABI } from "../abis/erc20.js";
import { validateAddress } from "./address.js";

const MAX_UINT256 = 2n ** 256n - 1n;

export type EnsureAllowanceParams = {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  token: Address;
  spender: Address;
  amount: bigint;
};

export type AllowanceResult = {
  approved: boolean;
  txHash?: Hash;
};

export async function ensureAllowance(
  params: EnsureAllowanceParams,
): Promise<AllowanceResult> {
  const { publicClient, walletClient, token, spender, amount } = params;
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
  const txHash = await walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, MAX_UINT256],
  });
  return { approved: true, txHash };
}

export type GetBalanceParams = {
  publicClient: PublicClient;
  token: Address;
  owner: Address;
};

export async function getBalance(params: GetBalanceParams): Promise<bigint> {
  return (await params.publicClient.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [params.owner],
  })) as bigint;
}
