// src/errors.ts
import type { Address, Hex } from "viem";

export class ChainNotSupportedError extends Error {
  constructor(public readonly chainId: number) {
    super(`chainId ${chainId} is not supported`);
    this.name = "ChainNotSupportedError";
  }
}

export class ProtocolNotSupportedError extends Error {
  constructor(
    public readonly chainId: number,
    public readonly protocol: string,
  ) {
    super(`chainId ${chainId} does not support protocol ${protocol}`);
    this.name = "ProtocolNotSupportedError";
  }
}

export class ReserveInactiveError extends Error {
  constructor(
    public readonly asset: Address,
    public readonly reason?: string,
  ) {
    super(
      reason
        ? `Reserve ${asset} is inactive: ${reason}`
        : `Reserve ${asset} is inactive`,
    );
    this.name = "ReserveInactiveError";
  }
}

export class InsufficientAllowanceError extends Error {
  constructor(
    public readonly token: Address,
    public readonly required: bigint,
    public readonly actual: bigint,
  ) {
    super(
      `Insufficient allowance for ${token}: required ${required}, actual ${actual}`,
    );
    this.name = "InsufficientAllowanceError";
  }
}

export class SlippageExceededError extends Error {
  constructor(
    public readonly bps: number,
    public readonly max: number,
  ) {
    super(`Slippage ${bps}bps exceeds maximum ${max}bps`);
    this.name = "SlippageExceededError";
  }
}

export class AddressValidationError extends Error {
  constructor(public readonly value: string) {
    super(`Invalid address: ${value}`);
    this.name = "AddressValidationError";
  }
}

export class ReceiptEventNotFoundError extends Error {
  constructor(
    public readonly eventName: string,
    public readonly txHash: Hex,
  ) {
    super(`Event ${eventName} not found in receipt for tx ${txHash}`);
    this.name = "ReceiptEventNotFoundError";
  }
}
