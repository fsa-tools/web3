import { describe, it, expect, vi } from "vitest";
import type { Address } from "viem";
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
});
