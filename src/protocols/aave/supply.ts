import { sendTxRequest } from "../../tx/send.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import { planSupply } from "./plan.js";
import type { SupplyOperationParams, SupplyResult } from "./types.js";

export async function supply(
  ctx: ChainContext,
  params: SupplyOperationParams,
): Promise<SupplyResult> {
  if (!ctx.walletClient) {
    throw new Error("supply requires walletClient in ChainContext");
  }
  if (!ctx.addresses.aave) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "aave",
    );
  }
  const poolAddress = ctx.addresses.aave.pool;
  const onBehalfOf = params.onBehalfOf ?? ctx.walletClient.account.address;

  // planSupply retorna [approve, supply]. A op envia só a supply (approve é
  // responsabilidade do caller — comportamento preservado da v3.0.0).
  const txs = planSupply({ ...params, poolAddress, onBehalfOf });
  const supplyTx = txs[txs.length - 1]!;
  const { txHash } = await sendTxRequest(ctx, supplyTx);

  return { txHash };
}
