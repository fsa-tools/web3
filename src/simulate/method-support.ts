import { MethodNotFoundRpcError, MethodNotSupportedRpcError } from "viem";

const CAUSE_CHAIN_MAX_DEPTH = 5;
const RPC_ERROR_CODE_METHOD_NOT_FOUND = -32601;
const RPC_ERROR_CODE_METHOD_NOT_SUPPORTED = -32004;
const METHOD_NOT_SUPPORTED_TEXT_SIGNALS = [
  "does not exist",
  "is not available",
  "not supported",
  "method not found",
];

function hasMethodNotSupportedSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return METHOD_NOT_SUPPORTED_TEXT_SIGNALS.some((signal) =>
    lower.includes(signal),
  );
}

/**
 * Detecta se um erro de RPC significa "o provider não implementa este
 * método" (típico de eth_simulateV1 em nós/relays mais antigos) — para o
 * caller cair no fallback eth_call sem confundir com revert de contrato ou
 * rate limit, que a rotação do rpc-pool já trata sozinha.
 */
export function isMethodNotSupportedError(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < CAUSE_CHAIN_MAX_DEPTH && cur; i++) {
    if (
      cur instanceof MethodNotFoundRpcError ||
      cur instanceof MethodNotSupportedRpcError
    )
      return true;
    if (typeof cur === "object" && cur !== null) {
      const candidate = cur as { code?: number; message?: string };
      if (
        candidate.code === RPC_ERROR_CODE_METHOD_NOT_FOUND ||
        candidate.code === RPC_ERROR_CODE_METHOD_NOT_SUPPORTED
      )
        return true;
      if (
        typeof candidate.message === "string" &&
        hasMethodNotSupportedSignal(candidate.message)
      )
        return true;
    }
    cur = (cur as { cause?: unknown })?.cause;
  }
  return false;
}
