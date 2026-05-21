import type { Hash, TransactionReceipt } from "viem";
import type { ChainContext } from "../context.js";
import type { GasOptions } from "../utils/gas.js";
import type { TxRequest } from "./types.js";

const RECEIPT_CONFIRMATIONS = 2;

export type SendTxResult = {
  txHash: Hash;
  receipt: TransactionReceipt;
};

export async function sendTxRequest(
  ctx: ChainContext,
  tx: TxRequest,
  gasOptions?: GasOptions,
): Promise<SendTxResult> {
  if (!ctx.walletClient) {
    throw new Error("sendTxRequest requires walletClient in ChainContext");
  }
  const txHash = await ctx.walletClient.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
    ...(gasOptions ?? {}),
  });
  const receipt = await ctx.publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: RECEIPT_CONFIRMATIONS,
  });
  return { txHash, receipt };
}
