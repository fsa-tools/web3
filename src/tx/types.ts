import type { Address, Hex } from "viem";

export type TxRequest = {
  readonly label: string;
  readonly to: Address;
  readonly data: Hex;
  readonly value: bigint;
};

export function isTxRequest(value: unknown): value is TxRequest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["label"] === "string" &&
    typeof candidate["to"] === "string" &&
    typeof candidate["data"] === "string" &&
    typeof candidate["value"] === "bigint"
  );
}
