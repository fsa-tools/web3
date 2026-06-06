import { describe, it, expect, vi } from "vitest";
import type { Address } from "viem";
import { ensureAllowance } from "../../../src/utils/erc20.js";
import type { ChainContext } from "../../../src/context.js";

const MAX_UINT256 = 2n ** 256n - 1n;

const TOKEN: Address = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const SPENDER: Address = "0x827922686190790b37229fd06084350E74485b72";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

type ApproveCall = { functionName: string; amount: bigint };
type MockContext = { ctx: ChainContext; approves: ApproveCall[] };

function buildMockContext(currentAllowance: bigint): MockContext {
  const approves: ApproveCall[] = [];
  const publicClient = {
    readContract: vi.fn(async () => currentAllowance),
    waitForTransactionReceipt: vi.fn(async () => ({})),
  } as unknown as ChainContext["publicClient"];

  const walletClient = {
    account: { address: OWNER },
    writeContract: vi.fn(
      async (p: { functionName: string; args: readonly [Address, bigint] }) => {
        approves.push({ functionName: p.functionName, amount: p.args[1] });
        return "0xabc" as `0x${string}`;
      },
    ),
  } as unknown as ChainContext["walletClient"];

  const ctx = { publicClient, walletClient } as unknown as ChainContext;
  return { ctx, approves };
}

describe("ensureAllowance", () => {
  it("should approve MAX_UINT256 when no approvalMode given and allowance is zero", async () => {
    const { ctx, approves } = buildMockContext(0n);
    const result = await ensureAllowance(ctx, {
      token: TOKEN,
      spender: SPENDER,
      amount: 1_000n,
    });
    expect(result.approved).toBe(true);
    expect(approves).toHaveLength(1);
    expect(approves[0]!.amount).toBe(MAX_UINT256);
  });

  it("should approve MAX_UINT256 when approvalMode is unlimited and allowance is zero", async () => {
    const { ctx, approves } = buildMockContext(0n);
    await ensureAllowance(ctx, {
      token: TOKEN,
      spender: SPENDER,
      amount: 1_000n,
      approvalMode: "unlimited",
    });
    expect(approves).toHaveLength(1);
    expect(approves[0]!.amount).toBe(MAX_UINT256);
  });

  it("should approve exact amount when approvalMode is exact and allowance is zero", async () => {
    const { ctx, approves } = buildMockContext(0n);
    await ensureAllowance(ctx, {
      token: TOKEN,
      spender: SPENDER,
      amount: 1_000n,
      approvalMode: "exact",
    });
    expect(approves).toHaveLength(1);
    expect(approves[0]!.amount).toBe(1_000n);
  });

  it("should reset to zero then approve exact amount when approvalMode is exact and allowance is positive", async () => {
    const { ctx, approves } = buildMockContext(5n);
    await ensureAllowance(ctx, {
      token: TOKEN,
      spender: SPENDER,
      amount: 1_000n,
      approvalMode: "exact",
    });
    expect(approves).toHaveLength(2);
    expect(approves[0]!.functionName).toBe("approve");
    expect(approves[0]!.amount).toBe(0n);
    expect(approves[1]!.amount).toBe(1_000n);
  });

  it("should return not-approved and not write when amount is zero", async () => {
    const { ctx, approves } = buildMockContext(0n);
    const result = await ensureAllowance(ctx, {
      token: TOKEN,
      spender: SPENDER,
      amount: 0n,
    });
    expect(result.approved).toBe(false);
    expect(approves).toHaveLength(0);
  });

  it("should return not-approved and not write when allowance is greater than or equal to amount", async () => {
    const { ctx, approves } = buildMockContext(2_000n);
    const result = await ensureAllowance(ctx, {
      token: TOKEN,
      spender: SPENDER,
      amount: 1_000n,
    });
    expect(result.approved).toBe(false);
    expect(approves).toHaveLength(0);
  });
});
