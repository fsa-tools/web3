import { describe, it, expect, vi } from "vitest";
import type { Address } from "viem";
import {
  createFakeProvider,
  createInjectedWalletClient,
  EXTENSION_ADDRESS,
} from "../_helpers/eip1193.js";
import { sendTxRequest } from "../../../src/tx/send.js";
import type { TxRequest } from "../../../src/tx/types.js";
import type { ChainContext } from "../../../src/context.js";

const TARGET: Address = "0x827922686190790b37229fd06084350E74485b72";

function mockCtx(): { ctx: ChainContext; sent: unknown[] } {
  const sent: unknown[] = [];
  const ctx = {
    publicClient: {
      waitForTransactionReceipt: vi.fn(async () => ({
        status: "success",
        gasUsed: 120_000n,
        logs: [],
      })),
    },
    walletClient: {
      account: { address: "0x0000000000000000000000000000000000000001" },
      sendTransaction: vi.fn(async (p: unknown) => {
        sent.push(p);
        return "0xhash" as `0x${string}`;
      }),
    },
  } as unknown as ChainContext;
  return { ctx, sent };
}

describe("sendTxRequest", () => {
  it("envia a calldata do TxRequest e devolve hash + receipt", async () => {
    const { ctx, sent } = mockCtx();
    const tx: TxRequest = {
      label: "collect",
      to: TARGET,
      data: "0xdeadbeef",
      value: 0n,
    };
    const result = await sendTxRequest(ctx, tx);
    expect(result.txHash).toBe("0xhash");
    expect(result.receipt.gasUsed).toBe(120_000n);
    expect(sent[0]).toMatchObject({
      to: TARGET,
      data: "0xdeadbeef",
      value: 0n,
    });
  });

  it("lança se não houver walletClient", async () => {
    const tx: TxRequest = { label: "x", to: TARGET, data: "0x", value: 0n };
    await expect(
      sendTxRequest({ publicClient: {} } as unknown as ChainContext, tx),
    ).rejects.toThrow("walletClient");
  });

  it("usa 2 confirmações quando ctx.confirmations é undefined", async () => {
    const { ctx } = mockCtx();
    const tx: TxRequest = { label: "x", to: TARGET, data: "0x", value: 0n };
    await sendTxRequest(ctx, tx);
    expect(ctx.publicClient.waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ confirmations: 2 }),
    );
  });

  it("usa ctx.confirmations quando definida", async () => {
    const { ctx } = mockCtx();
    ctx.confirmations = 1;
    const tx: TxRequest = { label: "x", to: TARGET, data: "0x", value: 0n };
    await sendTxRequest(ctx, tx);
    expect(ctx.publicClient.waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ confirmations: 1 }),
    );
  });
});

describe("sendTxRequest com walletClient injetado (EIP-1193, sem privateKey)", () => {
  function injectedCtx() {
    const provider = createFakeProvider();
    const ctx = {
      publicClient: {
        waitForTransactionReceipt: vi.fn(async () => ({
          status: "success",
          gasUsed: 90_000n,
          logs: [],
        })),
      },
      walletClient: createInjectedWalletClient(provider),
    } as unknown as ChainContext;
    return { ctx, provider };
  }

  it("delega a assinatura ao provider da extensão, sem chave na lib", async () => {
    const { ctx, provider } = injectedCtx();
    const tx: TxRequest = {
      label: "supply",
      to: TARGET,
      data: "0xdeadbeef",
      value: 0n,
    };

    const result = await sendTxRequest(ctx, tx);

    expect(result.txHash).toBe(`0x${"11".repeat(32)}`);
    const sendCall = provider.requests.find(
      (r) => r.method === "eth_sendTransaction",
    );
    expect(sendCall).toBeDefined();
    const [sent] = sendCall?.params as [Record<string, string>];
    expect(sent.from.toLowerCase()).toBe(EXTENSION_ADDRESS.toLowerCase());
    expect(sent.to?.toLowerCase()).toBe(TARGET.toLowerCase());
    expect(sent.data).toBe("0xdeadbeef");
    expect(
      provider.requests.some((r) => r.method.startsWith("eth_sign")),
    ).toBe(false);
    expect(
      provider.requests.some((r) => r.method === "eth_sendRawTransaction"),
    ).toBe(false);
  });

  it("repassa gasOptions ao provider", async () => {
    const { ctx, provider } = injectedCtx();
    const tx: TxRequest = { label: "x", to: TARGET, data: "0x", value: 0n };

    await sendTxRequest(ctx, tx, {
      maxFeePerGas: 2_000_000_000n,
      maxPriorityFeePerGas: 1_000_000n,
    });

    const sendCall = provider.requests.find(
      (r) => r.method === "eth_sendTransaction",
    );
    const [sent] = sendCall?.params as [Record<string, string>];
    expect(BigInt(sent.maxFeePerGas!)).toBe(2_000_000_000n);
    expect(BigInt(sent.maxPriorityFeePerGas!)).toBe(1_000_000n);
  });
});
