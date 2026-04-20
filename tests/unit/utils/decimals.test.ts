import { describe, it, expect, vi } from "vitest";
import { getTokenDecimals } from "../../../src/utils/decimals.js";
import type { ChainContext } from "../../../src/context.js";

const TOKEN = "0xaf88d065e77C8cC2239327C5EDb3A432268e5831" as const;
const CHAIN_ID = 42161;

function makeCtx(cache?: Map<string, number>): ChainContext {
  return {
    publicClient: {
      chain: { id: CHAIN_ID },
      readContract: vi.fn().mockResolvedValue(6),
    } as unknown as ChainContext["publicClient"],
    addresses: { weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
    decimalsCache: cache,
  };
}

describe("getTokenDecimals", () => {
  it("lê decimals on-chain quando cache não fornecido", async () => {
    const ctx = makeCtx();
    const result = await getTokenDecimals(ctx, { token: TOKEN });
    expect(result).toBe(6);
    expect(ctx.publicClient.readContract).toHaveBeenCalledTimes(1);
  });

  it("usa cache injetado quando token já está cacheado", async () => {
    const key = `${CHAIN_ID}:${TOKEN.toLowerCase()}`;
    const cache = new Map([[key, 18]]);
    const ctx = makeCtx(cache);
    const result = await getTokenDecimals(ctx, { token: TOKEN });
    expect(result).toBe(18);
    expect(ctx.publicClient.readContract).not.toHaveBeenCalled();
  });

  it("popula cache injetado após leitura on-chain", async () => {
    const cache = new Map<string, number>();
    const ctx = makeCtx(cache);
    await getTokenDecimals(ctx, { token: TOKEN });
    const key = `${CHAIN_ID}:${TOKEN.toLowerCase()}`;
    expect(cache.get(key)).toBe(6);
  });

  it("não cacheia quando decimalsCache ausente no ctx (chama on-chain cada vez)", async () => {
    const ctx = makeCtx(undefined);
    await getTokenDecimals(ctx, { token: TOKEN });
    await getTokenDecimals(ctx, { token: TOKEN });
    expect(ctx.publicClient.readContract).toHaveBeenCalledTimes(2);
  });

  it("lança quando publicClient não tem chain configurada", async () => {
    const ctx: ChainContext = {
      publicClient: {
        chain: undefined,
        readContract: vi.fn(),
      } as unknown as ChainContext["publicClient"],
      addresses: { weth: "0x0000000000000000000000000000000000000000" },
    };
    await expect(getTokenDecimals(ctx, { token: TOKEN })).rejects.toThrow(
      /chain configured/,
    );
  });
});
