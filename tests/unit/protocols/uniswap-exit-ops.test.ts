import { describe, it, expect, vi } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import { decreaseLiquidity } from "../../../src/protocols/uniswap-v3/decrease.js";
import { collectFees } from "../../../src/protocols/uniswap-v3/collect.js";
import { burnPosition } from "../../../src/protocols/uniswap-v3/burn.js";
import { NPM_ABI } from "../../../src/abis/npm.js";
import type { ChainContext } from "../../../src/context.js";

const NPM: Address = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

function mockCtx(): {
  ctx: ChainContext;
  sent: Array<{ to: Address; data: `0x${string}` }>;
} {
  const sent: Array<{ to: Address; data: `0x${string}` }> = [];
  const ctx = {
    publicClient: {
      chain: { id: 8453 },
      simulateContract: vi.fn(async () => ({ result: [10n, 20n] })),
      waitForTransactionReceipt: vi.fn(async () => ({
        gasUsed: 90_000n,
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
    addresses: { uniswapV3: { npm: NPM }, weth: OWNER },
  } as unknown as ChainContext;
  return { ctx, sent };
}

describe("uniswap-v3 exit ops — plan + send", () => {
  it("decreaseLiquidity envia calldata de decreaseLiquidity ao NPM", async () => {
    const { ctx, sent } = mockCtx();
    try {
      await decreaseLiquidity(ctx, {
        tokenId: 7n,
        liquidity: 1_000n,
        slippageBps: 50,
      });
    } catch {
      // parse de evento pode lançar com receipt mock vazio — só o roteamento da calldata importa
    }
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(NPM);
    expect(
      decodeFunctionData({ abi: NPM_ABI, data: sent[0]!.data }).functionName,
    ).toBe("decreaseLiquidity");
  });

  it("collectFees envia calldata de collect ao NPM", async () => {
    const { ctx, sent } = mockCtx();
    try {
      await collectFees(ctx, { tokenId: 7n, recipient: OWNER });
    } catch {
      // ignore parse
    }
    expect(sent[0]!.to).toBe(NPM);
    expect(
      decodeFunctionData({ abi: NPM_ABI, data: sent[0]!.data }).functionName,
    ).toBe("collect");
  });

  it("burnPosition envia calldata de burn ao NPM", async () => {
    const { ctx, sent } = mockCtx();
    await burnPosition(ctx, { tokenId: 7n });
    expect(sent[0]!.to).toBe(NPM);
    expect(
      decodeFunctionData({ abi: NPM_ABI, data: sent[0]!.data }).functionName,
    ).toBe("burn");
  });
});
