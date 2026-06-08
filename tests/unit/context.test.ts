// tests/unit/context.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http } from "viem";
import { createChainContext } from "../../src/context.js";
import { ChainNotSupportedError } from "../../src/errors.js";

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return { ...actual, http: vi.fn(actual.http) };
});

const BASE_RPC = "https://mainnet.base.org";
const BASE_CHAIN_ID = 8453;
const TEST_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

describe("createChainContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna contexto válido para chainId suportado sem privateKey", () => {
    const ctx = createChainContext({
      chainId: BASE_CHAIN_ID,
      rpcUrls: [BASE_RPC],
    });
    expect(ctx.publicClient).toBeDefined();
    expect(ctx.walletClient).toBeUndefined();
    expect(ctx.addresses.weth).toBe(
      "0x4200000000000000000000000000000000000006",
    );
    expect(ctx.decimalsCache).toBeUndefined();
  });

  it("cria walletClient quando privateKey fornecida", () => {
    const ctx = createChainContext({
      chainId: BASE_CHAIN_ID,
      rpcUrls: [BASE_RPC],
      privateKey: TEST_PK,
    });
    expect(ctx.walletClient).toBeDefined();
    expect(ctx.walletClient?.account.address).toMatch(/^0x/);
  });

  it("lança ChainNotSupportedError para chainId desconhecido", () => {
    expect(() =>
      createChainContext({ chainId: 99999, rpcUrls: [BASE_RPC] }),
    ).toThrow(ChainNotSupportedError);
  });

  it("propaga decimalsCache fornecido", () => {
    const cache = new Map<string, number>();
    const ctx = createChainContext({
      chainId: BASE_CHAIN_ID,
      rpcUrls: [BASE_RPC],
      decimalsCache: cache,
    });
    expect(ctx.decimalsCache).toBe(cache);
  });

  it("aceita múltiplos rpcUrls sem lançar", () => {
    expect(() =>
      createChainContext({
        chainId: BASE_CHAIN_ID,
        rpcUrls: ["https://rpc1.example.com", "https://rpc2.example.com"],
      }),
    ).not.toThrow();
  });

  it("endereços corretos para mainnet (chainId 1)", () => {
    const ctx = createChainContext({ chainId: 1, rpcUrls: [BASE_RPC] });
    expect(ctx.addresses.aave?.pool).toBe(
      "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    );
  });

  it("aceita rpcOptions completo e retorna publicClient definido", () => {
    const ctx = createChainContext({
      chainId: BASE_CHAIN_ID,
      rpcUrls: [BASE_RPC],
      rpc: {
        timeoutMs: 5000,
        retryCount: 0,
        cooldownMs: 30000,
        maxConcurrency: 4,
      },
    });
    expect(ctx.publicClient).toBeDefined();
  });

  it("passa httpOptions para http() quando timeoutMs/retryCount definidos", () => {
    createChainContext({
      chainId: BASE_CHAIN_ID,
      rpcUrls: [BASE_RPC],
      rpc: { timeoutMs: 1234, retryCount: 2 },
    });
    expect(vi.mocked(http)).toHaveBeenCalledWith(BASE_RPC, {
      timeout: 1234,
      retryCount: 2,
    });
  });

  it("chama http() sem 2º argumento quando rpc é undefined", () => {
    createChainContext({
      chainId: BASE_CHAIN_ID,
      rpcUrls: [BASE_RPC],
    });
    expect(vi.mocked(http)).toHaveBeenCalledWith(BASE_RPC);
    expect(vi.mocked(http)).not.toHaveBeenCalledWith(
      BASE_RPC,
      expect.anything(),
    );
  });
});
