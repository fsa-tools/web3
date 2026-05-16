import { describe, it, expect, vi } from "vitest";
import type { Address } from "viem";
import { swapExactInputSingle } from "../../../src/protocols/uniswap-v3/swap.js";
import type { ChainContext } from "../../../src/context.js";

const SWAP_ROUTER: Address = "0x2626664c2603336E57B271c5C0b26F421741e481";
const TOKEN_IN: Address = "0x4200000000000000000000000000000000000006";
const TOKEN_OUT: Address = "0x9999999999999999999999999999999999999999";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";
const Q96 = 2n ** 96n;

type Mock = {
  ctx: ChainContext;
  calls: Array<{ functionName: string; args: readonly unknown[] }>;
};

function buildMockContext(): Mock {
  const calls: Mock["calls"] = [];
  let balanceOfCallCount = 0;

  const publicClient = {
    chain: { id: 8453 },
    readContract: vi.fn(async (p: { functionName: string }) => {
      if (p.functionName === "allowance") return 0n;
      if (p.functionName === "balanceOf") {
        balanceOfCallCount += 1;
        // 1ª leitura (antes do swap) = 0; 2ª (depois) = 500
        return balanceOfCallCount === 1 ? 0n : 500n;
      }
      return 0n;
    }),
    waitForTransactionReceipt: vi.fn(async () => ({
      gasUsed: 120_000n,
      logs: [],
    })),
  } as unknown as ChainContext["publicClient"];

  const walletClient = {
    account: { address: OWNER },
    writeContract: vi.fn(
      async (p: { functionName: string; args: readonly unknown[] }) => {
        calls.push({ functionName: p.functionName, args: p.args });
        return "0xswaptx" as `0x${string}`;
      },
    ),
  } as unknown as ChainContext["walletClient"];

  const ctx = {
    publicClient,
    walletClient,
    addresses: {
      weth: TOKEN_IN,
      uniswapV3: { npm: "0x0" as Address, swapRouter: SWAP_ROUTER },
    },
  } as unknown as ChainContext;

  return { ctx, calls };
}

describe("swapExactInputSingle", () => {
  it("aprova tokenIn antes do swap e retorna amountOut por delta de saldo", async () => {
    const { ctx, calls } = buildMockContext();

    const result = await swapExactInputSingle(ctx, {
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      fee: 500,
      amountIn: 1_000n,
      sqrtPriceX96: Q96,
      slippageBps: 100,
    });

    expect(result.amountOut).toBe(500n);
    expect(result.txHash).toBe("0xswaptx");

    const approveIdx = calls.findIndex((c) => c.functionName === "approve");
    const swapIdx = calls.findIndex(
      (c) => c.functionName === "exactInputSingle",
    );
    expect(approveIdx).toBeGreaterThan(-1);
    expect(swapIdx).toBeGreaterThan(approveIdx);
  });

  it("falha quando a chain não tem swapRouter configurado", async () => {
    const { ctx } = buildMockContext();
    const ctxSemRouter = {
      ...ctx,
      addresses: { ...ctx.addresses, uniswapV3: { npm: "0x0" as Address } },
    } as unknown as ChainContext;

    await expect(
      swapExactInputSingle(ctxSemRouter, {
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        fee: 500,
        amountIn: 1_000n,
        sqrtPriceX96: Q96,
        slippageBps: 100,
      }),
    ).rejects.toThrow();
  });
});
