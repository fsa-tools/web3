// tests/types/viem-inference.test-d.ts
import { expectTypeOf } from "vitest";
import { createChainContext } from "../../src/context.js";
import type { ChainContext } from "../../src/context.js";
import {
  ChainNotSupportedError,
  ProtocolNotSupportedError,
  SlippageExceededError,
  ReserveInactiveError,
  InsufficientAllowanceError,
  AddressValidationError,
  ReceiptEventNotFoundError,
} from "../../src/errors.js";

// ChainContext é um tipo estável com as propriedades esperadas
expectTypeOf<ChainContext>().toHaveProperty("publicClient");
expectTypeOf<ChainContext>().toHaveProperty("walletClient");
expectTypeOf<ChainContext>().toHaveProperty("addresses");
expectTypeOf<ChainContext>().toHaveProperty("decimalsCache");

// decimalsCache é opcional
expectTypeOf<ChainContext["decimalsCache"]>().toEqualTypeOf<
  Map<string, number> | undefined
>();

// createChainContext retorna ChainContext
expectTypeOf(
  createChainContext({ chainId: 8453, rpcUrls: ["https://mainnet.base.org"] }),
).toEqualTypeOf<ChainContext>();

// Erros tipados são subclasses de Error
expectTypeOf<ChainNotSupportedError>().toMatchTypeOf<Error>();
expectTypeOf<ProtocolNotSupportedError>().toMatchTypeOf<Error>();
expectTypeOf<SlippageExceededError>().toMatchTypeOf<Error>();
expectTypeOf<ReserveInactiveError>().toMatchTypeOf<Error>();
expectTypeOf<InsufficientAllowanceError>().toMatchTypeOf<Error>();
expectTypeOf<AddressValidationError>().toMatchTypeOf<Error>();
expectTypeOf<ReceiptEventNotFoundError>().toMatchTypeOf<Error>();

// Campos estruturados de erros são tipados corretamente
expectTypeOf<ChainNotSupportedError["chainId"]>().toEqualTypeOf<number>();
expectTypeOf<ProtocolNotSupportedError["chainId"]>().toEqualTypeOf<number>();
expectTypeOf<ProtocolNotSupportedError["protocol"]>().toEqualTypeOf<string>();
expectTypeOf<SlippageExceededError["bps"]>().toEqualTypeOf<number>();
expectTypeOf<SlippageExceededError["max"]>().toEqualTypeOf<number>();
expectTypeOf<ReserveInactiveError["reason"]>().toEqualTypeOf<
  string | undefined
>();
expectTypeOf<InsufficientAllowanceError["required"]>().toEqualTypeOf<bigint>();
expectTypeOf<InsufficientAllowanceError["actual"]>().toEqualTypeOf<bigint>();
expectTypeOf<AddressValidationError["value"]>().toEqualTypeOf<string>();
expectTypeOf<
  ReceiptEventNotFoundError["txHash"]
>().toEqualTypeOf<`0x${string}`>();
