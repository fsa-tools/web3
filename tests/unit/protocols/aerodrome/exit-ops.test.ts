import { describe, it, expect, vi } from "vitest";
import type { Address } from "viem";
import { decreaseLiquidity } from "../../../../src/protocols/aerodrome/decrease.js";
import { applySlippage } from "../../../../src/math/slippage.js";
import type { ChainContext } from "../../../../src/context.js";

const NPM: Address = "0x827922686190790b37229fd06084350E74485b72";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

function mockCtx(): {
  ctx: ChainContext;
  simulateContract: ReturnType<typeof vi.fn>;
  writeContract: ReturnType<typeof vi.fn>;
  capture: () => { args: readonly unknown[] } | undefined;
} {
  let captured: { args: readonly unknown[] } | undefined;

  const simulateContract = vi.fn(async () => ({ result: [1_000n, 2_000n] }));
  const writeContract = vi.fn(async (p: { args: readonly unknown[] }) => {
    captured = p;
    return "0xhash" as `0x${string}`;
  });

  const ctx = {
    publicClient: {
      chain: { id: 8453 },
      simulateContract,
      waitForTransactionReceipt: vi.fn(async () => ({
        gasUsed: 90_000n,
        logs: [],
      })),
    },
    walletClient: {
      account: { address: OWNER },
      writeContract,
    },
    addresses: { aerodrome: { npm: NPM }, weth: OWNER },
  } as unknown as ChainContext;

  return { ctx, simulateContract, writeContract, capture: () => captured };
}

describe("aerodrome exit ops — decreaseLiquidity slippage", () => {
  it("deriva mins de slippageBps quando mins não são fornecidos", async () => {
    const { ctx, capture } = mockCtx();

    try {
      await decreaseLiquidity(ctx, {
        npmAddress: NPM,
        nftId: 7n,
        liquidity: 500_000n,
        slippageBps: 50,
      });
    } catch {
      // parse pós-receipt pode lançar com receipt mock vazio — só args importam
    }

    const call = capture();
    const args = call?.args[0] as { amount0Min: bigint; amount1Min: bigint };
    expect(args.amount0Min).toBe(applySlippage(1_000n, 50));
    expect(args.amount1Min).toBe(applySlippage(2_000n, 50));
  });

  it("mins explícitos têm precedência sobre os derivados de slippageBps", async () => {
    const { ctx, capture } = mockCtx();

    try {
      await decreaseLiquidity(ctx, {
        npmAddress: NPM,
        nftId: 7n,
        liquidity: 500_000n,
        slippageBps: 50,
        amount0Min: 999n,
      });
    } catch {
      // ignore parse
    }

    const call = capture();
    const args = call?.args[0] as { amount0Min: bigint; amount1Min: bigint };
    expect(args.amount0Min).toBe(999n);
    expect(args.amount1Min).toBe(applySlippage(2_000n, 50));
  });

  it("retrocompat: sem slippageBps e sem mins, usa 0n e não simula", async () => {
    const { ctx, simulateContract, capture } = mockCtx();

    try {
      await decreaseLiquidity(ctx, {
        npmAddress: NPM,
        nftId: 7n,
        liquidity: 500_000n,
      });
    } catch {
      // ignore parse
    }

    const call = capture();
    const args = call?.args[0] as { amount0Min: bigint; amount1Min: bigint };
    expect(args.amount0Min).toBe(0n);
    expect(args.amount1Min).toBe(0n);
    expect(simulateContract).toHaveBeenCalledTimes(0);
  });
});
