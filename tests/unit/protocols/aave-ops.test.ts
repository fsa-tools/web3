import { describe, it, expect, vi } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import { supply } from "../../../src/protocols/aave/supply.js";
import { withdraw } from "../../../src/protocols/aave/withdraw.js";
import { AAVE_POOL_ABI } from "../../../src/abis/aave-pool.js";
import type { ChainContext } from "../../../src/context.js";

const POOL: Address = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
const ASSET: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

function mockCtx(): {
  ctx: ChainContext;
  sent: Array<{ to: Address; data: `0x${string}` }>;
} {
  const sent: Array<{ to: Address; data: `0x${string}` }> = [];
  const ctx = {
    publicClient: {
      chain: { id: 8453 },
      waitForTransactionReceipt: vi.fn(async () => ({
        gasUsed: 200_000n,
        logs: [],
      })),
    },
    walletClient: {
      account: { address: OWNER },
      sendTransaction: vi.fn(
        async (p: { to: Address; data: `0x${string}` }) => {
          sent.push({ to: p.to, data: p.data });
          return "0xhash" as `0x${string}`;
        },
      ),
    },
    addresses: { aave: { pool: POOL }, weth: OWNER },
  } as unknown as ChainContext;
  return { ctx, sent };
}

describe("aave ops — plan + send", () => {
  it("supply envia calldata de supply ao pool", async () => {
    const { ctx, sent } = mockCtx();
    await supply(ctx, { asset: ASSET, amount: 5_000_000_000n });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(POOL);
    expect(
      decodeFunctionData({ abi: AAVE_POOL_ABI, data: sent[0]!.data })
        .functionName,
    ).toBe("supply");
  });

  it("withdraw envia calldata de withdraw ao pool", async () => {
    const { ctx, sent } = mockCtx();
    await withdraw(ctx, { asset: ASSET, amount: 3_000_000_000n });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(POOL);
    expect(
      decodeFunctionData({ abi: AAVE_POOL_ABI, data: sent[0]!.data })
        .functionName,
    ).toBe("withdraw");
  });
});
