import type { Hex, TypedDataDefinition } from "viem";
import type { ChainContext } from "../context.js";

/**
 * Assina uma mensagem EIP-712 pelo walletClient do contexto.
 *
 * Funciona igual para os dois modos de assinatura: conta local derivada de
 * `privateKey` (server-side) ou carteira injetada por um provider EIP-1193 —
 * no segundo caso a assinatura acontece na extensão e a lib nunca vê a chave.
 * É o seam que o permit EIP-2612 consome (par de fsa-tools/web3#9).
 */
export async function signTypedData(
  ctx: ChainContext,
  typedData: TypedDataDefinition,
): Promise<Hex> {
  if (!ctx.walletClient) {
    throw new Error("signTypedData requires walletClient in ChainContext");
  }
  return ctx.walletClient.signTypedData(typedData);
}
