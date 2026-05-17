import { describe, it, expect, vi } from "vitest";
import type { Address } from "viem";
import { quoteExactInputSingle } from "../../../src/protocols/uniswap-v3/quote.js";
import { ProtocolNotSupportedError } from "../../../src/errors.js";
import type { ChainContext } from "../../../src/context.js";

const QUOTER: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const TOKEN_IN: Address = "0x4200000000000000000000000000000000000006";
const TOKEN_OUT: Address = "0x9999999999999999999999999999999999999999";
const Q96 = 2n ** 96n;

type ReadCall = {
  address: Address;
  functionName: string;
  args: readonly unknown[];
};

function buildCtx(opts?: { quoter?: Address }): {
  ctx: ChainContext;
  reads: ReadCall[];
} {
  const reads: ReadCall[] = [];
  const publicClient = {
    chain: { id: 8453 },
    readContract: vi.fn(async (p: ReadCall) => {
      reads.push(p);
      // [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
      return [1_900_000n, Q96, 3, 95_000n];
    }),
  } as unknown as ChainContext["publicClient"];

  const ctx = {
    publicClient,
    addresses: {
      weth: TOKEN_IN,
      uniswapV3: { npm: "0x0" as Address, quoter: opts?.quoter },
    },
  } as unknown as ChainContext;

  return { ctx, reads };
}

describe("quoteExactInputSingle", () => {
  it("retorna o amountOut efetivo cotado pelo QuoterV2", async () => {
    const { ctx } = buildCtx({ quoter: QUOTER });

    const result = await quoteExactInputSingle(ctx, {
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      fee: 3000,
      amountIn: 1_000_000_000_000_000_000n,
    });

    expect(result.amountOut).toBe(1_900_000n);
    expect(result.sqrtPriceX96After).toBe(Q96);
    expect(result.initializedTicksCrossed).toBe(3);
    expect(result.gasEstimate).toBe(95_000n);
  });

  it("chama o contrato QuoterV2 sem price limit", async () => {
    const { ctx, reads } = buildCtx({ quoter: QUOTER });

    await quoteExactInputSingle(ctx, {
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      fee: 500,
      amountIn: 42n,
    });

    expect(reads).toHaveLength(1);
    expect(reads[0]?.address).toBe(QUOTER);
    expect(reads[0]?.functionName).toBe("quoteExactInputSingle");
    const arg = reads[0]?.args[0] as Record<string, unknown>;
    expect(arg.sqrtPriceLimitX96).toBe(0n);
    expect(arg.amountIn).toBe(42n);
    expect(arg.fee).toBe(500);
  });

  it("lança ProtocolNotSupportedError quando a chain não tem quoter", async () => {
    const { ctx } = buildCtx({ quoter: undefined });

    await expect(
      quoteExactInputSingle(ctx, {
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        fee: 3000,
        amountIn: 1n,
      }),
    ).rejects.toThrow(ProtocolNotSupportedError);
  });
});
