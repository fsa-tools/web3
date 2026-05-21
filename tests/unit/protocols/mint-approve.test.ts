import { describe, it, expect, vi } from "vitest";
import type { Address } from "viem";
import { mintPosition as mintUniswapV3 } from "../../../src/protocols/uniswap-v3/mint.js";
import { mintPosition as mintAerodrome } from "../../../src/protocols/aerodrome/mint.js";
import type { ChainContext } from "../../../src/context.js";

const NPM_UNISWAP: Address = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const NPM_AERODROME: Address = "0x827922686190790b37229fd06084350E74485b72";
const TOKEN0: Address = "0x4200000000000000000000000000000000000006";
const TOKEN1: Address = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

type Call = { kind: "write" | "send"; address: Address; functionName: string };
type MockContext = { ctx: ChainContext; calls: Call[] };

function buildMockContext(): MockContext {
  const calls: Call[] = [];
  const receipt = {
    gasUsed: 100_000n,
    logs: [
      {
        address: NPM_UNISWAP,
        topics: [
          "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f",
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        ],
        data: "0x" + "00".repeat(128),
        eventName: "IncreaseLiquidity",
        args: { tokenId: 1n, liquidity: 1_000n, amount0: 1n, amount1: 2n },
      },
    ],
  };
  const publicClient = {
    chain: { id: 8453 },
    readContract: vi.fn(async () => 0n),
    waitForTransactionReceipt: vi.fn(async () => receipt),
  } as unknown as ChainContext["publicClient"];

  const walletClient = {
    account: { address: OWNER },
    writeContract: vi.fn(
      async (p: { address: Address; functionName: string }) => {
        calls.push({
          kind: "write",
          address: p.address,
          functionName: p.functionName,
        });
        return "0xabc" as `0x${string}`;
      },
    ),
    sendTransaction: vi.fn(async (p: { to: Address }) => {
      calls.push({ kind: "send", address: p.to, functionName: "__send__" });
      return "0xdef" as `0x${string}`;
    }),
  } as unknown as ChainContext["walletClient"];

  const ctx = {
    publicClient,
    walletClient,
    addresses: {
      uniswapV3: { npm: NPM_UNISWAP, factory: "0x0" as Address },
      weth: TOKEN0,
    },
  } as unknown as ChainContext;
  return { ctx, calls };
}

describe("mintPosition (uniswap-v3) — plan + send", () => {
  it("aprova token0/token1 (writeContract) e envia o mint via sendTransaction ao NPM", async () => {
    const { ctx, calls } = buildMockContext();
    await mintUniswapV3(ctx, {
      token0: TOKEN0,
      token1: TOKEN1,
      fee: 100,
      tickLower: -200_000,
      tickUpper: -190_000,
      amount0Desired: 1_000_000_000_000_000n,
      amount1Desired: 1_000_000n,
      slippageBps: 100,
    });
    const approves = calls.filter((c) => c.functionName === "approve");
    expect(approves).toHaveLength(2);
    expect(approves.map((c) => c.address)).toEqual([TOKEN0, TOKEN1]);
    const sendIdx = calls.findIndex((c) => c.kind === "send");
    expect(sendIdx).toBeGreaterThan(-1);
    expect(calls[sendIdx]!.address).toBe(NPM_UNISWAP);
    // os 2 approves vêm antes do send do mint
    expect(
      calls
        .filter((c) => c.functionName === "approve")
        .every((_c, i) => calls.indexOf(approves[i]!) < sendIdx),
    ).toBe(true);
  });
});

describe("mintPosition (aerodrome) — pre-mint approvals", () => {
  it("chama approve em token0 e token1 antes do mint", async () => {
    const { ctx, calls } = buildMockContext();
    try {
      await mintAerodrome(ctx, {
        npmAddress: NPM_AERODROME,
        token0: TOKEN0,
        token1: TOKEN1,
        tickSpacing: 1,
        tickLower: -200_000,
        tickUpper: -190_000,
        amount0Desired: 1_000_000_000_000_000n,
        amount1Desired: 1_000_000n,
        slippageBps: 100,
        sqrtPriceX96: 0n,
      });
    } catch {
      // aerodrome não foi refatorado nesta spec — mantém writeContract; parse de log pode lançar
    }
    const approves = calls.filter((c) => c.functionName === "approve");
    expect(approves).toHaveLength(2);
    const mintIdx = calls.findIndex((c) => c.functionName === "mint");
    expect(mintIdx).toBeGreaterThan(-1);
  });
});
