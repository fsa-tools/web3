// tests/smoke/context.smoke.test.ts
import { describe, it, expect } from "vitest";
import { createChainContext } from "../../src/context.js";

const BASE_CHAIN_ID = 8453;

describe("createChainContext — fallback RPC smoke", () => {
  it("usa segunda URL quando primeira é inválida (fallback ativo)", async () => {
    const realRpc = process.env["BASE_RPC"];
    if (!realRpc) {
      console.log("Skip: BASE_RPC não configurada");
      return;
    }

    // Primeira URL inválida, segunda é a real
    const ctx = createChainContext({
      chainId: BASE_CHAIN_ID,
      rpcUrls: ["https://invalid.rpc.url.that.does.not.exist", realRpc],
    });

    // Deve conseguir fazer uma chamada on-chain via fallback
    const blockNumber = await ctx.publicClient.getBlockNumber();
    expect(blockNumber).toBeGreaterThan(0n);
  });
});
