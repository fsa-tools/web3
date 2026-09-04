import {
  AbiDecodingZeroDataError,
  AbiErrorSignatureNotFoundError,
  decodeErrorResult,
} from "viem";
import type { Abi, Hex } from "viem";
import { AAVE_ERROR_CODES } from "../abis/aave-errors.js";

const PANIC_REASONS: Readonly<Record<number, string>> = {
  0x01: "Assertion failed",
  0x11: "Arithmetic overflow or underflow",
  0x12: "Division or modulo by zero",
  0x21: "Invalid enum value",
  0x22: "Invalid storage byte array access",
  0x31: "Pop on empty array",
  0x32: "Array index out of bounds",
  0x41: "Out of memory",
  0x51: "Invalid internal function call",
};

function formatAaveReason(code: string): string {
  const entry = AAVE_ERROR_CODES[code];
  if (!entry) return code;
  return `${entry.name} (Aave #${code}): ${entry.description}`;
}

function formatPanicReason(code: bigint): string {
  const reason = PANIC_REASONS[Number(code)];
  return reason ?? `Panic(0x${code.toString(16)})`;
}

function formatCustomErrorReason(errorName: string, args: unknown): string {
  const argList = Array.isArray(args) ? args : [];
  return `${errorName}(${argList.map(String).join(", ")})`;
}

/**
 * Decodifica o revert data cru de um eth_call/eth_simulateV1 contra as ABIs
 * de protocolo fornecidas, mais Error(string)/Panic(uint256) padrão (viem
 * inclui os dois automaticamente). Códigos numéricos da Aave (Errors.sol) são
 * traduzidos para o nome da constante. Retorna undefined quando não há data,
 * o revert é silencioso (sem data), ou o selector não bate com nenhuma ABI
 * conhecida — nesses casos o chamador ainda tem o hex cru para inspecionar.
 */
export function decodeRevertReason(
  data: Hex | undefined,
  abis: readonly Abi[] = [],
): string | undefined {
  if (!data || data === "0x") return undefined;

  const mergedAbi = abis.flat() as Abi;
  try {
    const decoded = decodeErrorResult({ abi: mergedAbi, data });
    if (decoded.errorName === "Error") {
      const [message] = decoded.args as [string];
      return formatAaveReason(message);
    }
    if (decoded.errorName === "Panic") {
      const [code] = decoded.args as [bigint];
      return formatPanicReason(code);
    }
    return formatCustomErrorReason(decoded.errorName, decoded.args);
  } catch (err) {
    if (err instanceof AbiDecodingZeroDataError) return undefined;
    if (err instanceof AbiErrorSignatureNotFoundError) return undefined;
    throw err;
  }
}
