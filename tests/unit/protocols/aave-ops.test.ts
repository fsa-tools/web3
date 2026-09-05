import { describe, it, expect, vi } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import { supply } from "../../../src/protocols/aave/supply.js";
import { withdraw } from "../../../src/protocols/aave/withdraw.js";
import { AAVE_POOL_ABI } from "../../../src/abis/aave-pool.js";
import type { ChainContext } from "../../../src/context.js";
import {
  createFakeProvider,
  createInjectedWalletClient,
  EXTENSION_ADDRESS,
} from "../_helpers/eip1193.js";
import { ADDRESSES } from "../../../src/constants/addresses.js";

const POOL: Address = ADDRESSES[8453]!.aave!.pool;
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

describe("aave supply com walletClient injetado (EIP-1193, sem privateKey)", () => {
  function injectedCtx() {
    const provider = createFakeProvider();
    const ctx = {
      publicClient: {
        chain: { id: 8453 },
        waitForTransactionReceipt: vi.fn(async () => ({
          gasUsed: 200_000n,
          logs: [],
        })),
      },
      walletClient: createInjectedWalletClient(provider),
      addresses: { aave: { pool: POOL }, weth: OWNER },
    } as unknown as ChainContext;
    return { ctx, provider };
  }

  it("delega o supply ao provider da extensão, sem privateKey no context", async () => {
    const { ctx, provider } = injectedCtx();

    const result = await supply(ctx, {
      asset: ASSET,
      amount: 5_000_000_000n,
    });

    expect(result.txHash).toBe(`0x${"11".repeat(32)}`);
    const sendCall = provider.requests.find(
      (r) => r.method === "eth_sendTransaction",
    );
    expect(sendCall).toBeDefined();
    const [sent] = sendCall?.params as [
      { from: string; to: string; data: `0x${string}` },
    ];
    expect(sent.from.toLowerCase()).toBe(EXTENSION_ADDRESS.toLowerCase());
    expect(sent.to.toLowerCase()).toBe(POOL.toLowerCase());
    expect(
      decodeFunctionData({ abi: AAVE_POOL_ABI, data: sent.data }).functionName,
    ).toBe("supply");
  });
});
