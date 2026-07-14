import { describe, it, expect, vi } from "vitest";
import type { Address, Hash } from "viem";
import { swapExactInputSingle } from "../../../../src/protocols/aerodrome/swap.js";
import { mintPosition } from "../../../../src/protocols/aerodrome/mint.js";
import type { ChainContext } from "../../../../src/context.js";

const SWAP_ROUTER: Address = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const QUOTER: Address = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0";
const NPM_AERODROME: Address = "0x827922686190790b37229fd06084350E74485b72";
const TOKEN_IN: Address = "0x4200000000000000000000000000000000000006";
const TOKEN_OUT: Address = "0x9999999999999999999999999999999999999999";
const TOKEN0: Address = "0x4200000000000000000000000000000000000006";
const TOKEN1: Address = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";
const Q96 = 2n ** 96n;
// mesmo topic que mint.ts usa pra parsear o log raw de IncreaseLiquidity
// (AERODROME_NPM_ABI nao tem eventos)
const INCREASE_LIQUIDITY_TOPIC =
  "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f";

/** amountOut cotado pelo Quoter — base do amountOutMinimum. */
const QUOTED_OUT = 2_000n;

type ReceiptMock = {
  transactionHash: Hash;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  logs: unknown[];
};

/**
 * writeContract devolve um hash distinto por chamada e waitForTransactionReceipt
 * devolve um receipt identificavel pelo hash recebido — sem isso nao da pra
 * afirmar quais receipts sao dos approves e qual e o da tx principal.
 */
function buildHashAwareClients(mainFunctionNames: readonly string[]) {
  let hashCounter = 0;
  const receiptsByHash = new Map<Hash, ReceiptMock>();

  const writeContract = vi.fn(
    async (p: { functionName: string; args: readonly unknown[] }) => {
      hashCounter += 1;
      const hash = `0xhash${hashCounter}` as Hash;
      const isMainTx = mainFunctionNames.includes(p.functionName);
      receiptsByHash.set(hash, {
        transactionHash: hash,
        gasUsed: 100_000n + BigInt(hashCounter),
        effectiveGasPrice: 1_000_000_000n,
        logs: isMainTx
          ? [
              {
                topics: [
                  INCREASE_LIQUIDITY_TOPIC,
                  "0x0000000000000000000000000000000000000000000000000000000000000001",
                ],
                data: "0x" + "00".repeat(128),
              },
            ]
          : [],
      });
      return hash;
    },
  );

  const waitForTransactionReceipt = vi.fn(async (p: { hash: Hash }) => {
    return receiptsByHash.get(p.hash);
  });

  return { writeContract, waitForTransactionReceipt };
}

function buildSwapMockContext(allowance: bigint): ChainContext {
  let balanceOfCallCount = 0;
  const { writeContract, waitForTransactionReceipt } = buildHashAwareClients([
    "exactInputSingle",
  ]);

  const publicClient = {
    chain: { id: 8453 },
    readContract: vi.fn(async (p: { functionName: string }) => {
      if (p.functionName === "allowance") return allowance;
      if (p.functionName === "quoteExactInputSingle") {
        // [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
        return [QUOTED_OUT, Q96, 1, 90_000n];
      }
      if (p.functionName === "balanceOf") {
        balanceOfCallCount += 1;
        // 1ª leitura (antes do swap) = 0; 2ª (depois) = 500
        return balanceOfCallCount === 1 ? 0n : 500n;
      }
      return 0n;
    }),
    waitForTransactionReceipt,
  } as unknown as ChainContext["publicClient"];

  const walletClient = {
    account: { address: OWNER },
    writeContract,
  } as unknown as ChainContext["walletClient"];

  return {
    publicClient,
    walletClient,
    addresses: {
      weth: TOKEN_IN,
      aerodrome: {
        npm: "0x0" as Address,
        swapRouter: SWAP_ROUTER,
        quoter: QUOTER,
      },
    },
  } as unknown as ChainContext;
}

function buildMintMockContext(allowance: bigint): ChainContext {
  const { writeContract, waitForTransactionReceipt } = buildHashAwareClients([
    "mint",
  ]);

  const publicClient = {
    chain: { id: 8453 },
    readContract: vi.fn(async (p: { functionName: string }) => {
      if (p.functionName === "allowance") return allowance;
      return 0n;
    }),
    waitForTransactionReceipt,
  } as unknown as ChainContext["publicClient"];

  const walletClient = {
    account: { address: OWNER },
    writeContract,
  } as unknown as ChainContext["walletClient"];

  return {
    publicClient,
    walletClient,
    addresses: { weth: TOKEN0 },
  } as unknown as ChainContext;
}

describe("swapExactInputSingle (aerodrome) — approvalReceipts", () => {
  it("allowance 0 → approvalReceipts tem 1 item, e nao e o receipt do swap", async () => {
    const ctx = buildSwapMockContext(0n);

    const result = await swapExactInputSingle(ctx, {
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      tickSpacing: 100,
      amountIn: 1_000n,
      slippageBps: 100,
    });

    expect(result.approvalReceipts).toHaveLength(1);
    expect(result.approvalReceipts[0]?.transactionHash).not.toBe(result.txHash);
  });

  it("allowance suficiente → approvalReceipts e []", async () => {
    const ctx = buildSwapMockContext(1_000_000n);

    const result = await swapExactInputSingle(ctx, {
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      tickSpacing: 100,
      amountIn: 1_000n,
      slippageBps: 100,
    });

    expect(result.approvalReceipts).toEqual([]);
  });
});

describe("mintPosition (aerodrome) — approvalReceipts", () => {
  it("allowance 0 nos dois tokens → approvalReceipts tem 2 itens, na ordem [token0, token1]", async () => {
    const ctx = buildMintMockContext(0n);

    const result = await mintPosition(ctx, {
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

    expect(result.approvalReceipts).toHaveLength(2);
    expect(result.approvalReceipts[0]?.transactionHash).toBe("0xhash1");
    expect(result.approvalReceipts[1]?.transactionHash).toBe("0xhash2");
  });

  it("allowance suficiente nos dois tokens → approvalReceipts e []", async () => {
    const ctx = buildMintMockContext(1_000_000_000_000_000n);

    const result = await mintPosition(ctx, {
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

    expect(result.approvalReceipts).toEqual([]);
  });
});
