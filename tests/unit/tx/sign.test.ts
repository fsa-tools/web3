import { describe, it, expect } from "vitest";
import type { Address } from "viem";
import { signTypedData } from "../../../src/tx/sign.js";
import type { ChainContext } from "../../../src/context.js";
import {
  createFakeProvider,
  createInjectedWalletClient,
  EXTENSION_ADDRESS,
} from "../_helpers/eip1193.js";

const USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SPENDER: Address = "0x827922686190790b37229fd06084350E74485b72";
const BASE_CHAIN_ID = 8453;

// Mensagem EIP-2612 típica — o par de fsa-tools/web3#9 monta exatamente isto.
const PERMIT = {
  domain: {
    name: "USD Coin",
    version: "2",
    chainId: BASE_CHAIN_ID,
    verifyingContract: USDC,
  },
  types: {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Permit",
  message: {
    owner: EXTENSION_ADDRESS,
    spender: SPENDER,
    value: 1_000_000n,
    nonce: 0n,
    deadline: 1_800_000_000n,
  },
} as const;

function injectedCtx() {
  const provider = createFakeProvider();
  const ctx = {
    publicClient: {},
    walletClient: createInjectedWalletClient(provider),
  } as unknown as ChainContext;
  return { ctx, provider };
}

describe("signTypedData", () => {
  it("assina o permit pela carteira injetada e devolve a assinatura", async () => {
    const { ctx, provider } = injectedCtx();

    const signature = await signTypedData(ctx, PERMIT);

    expect(signature).toBe(`0x${"22".repeat(65)}`);
    const call = provider.requests.find(
      (r) => r.method === "eth_signTypedData_v4",
    );
    expect(call).toBeDefined();
    const [address, payload] = call?.params as [string, string];
    expect(address.toLowerCase()).toBe(EXTENSION_ADDRESS.toLowerCase());
    const decoded = JSON.parse(payload) as {
      primaryType: string;
      domain: { chainId: number; verifyingContract: string };
      message: Record<string, string>;
    };
    expect(decoded.primaryType).toBe("Permit");
    expect(decoded.domain.verifyingContract.toLowerCase()).toBe(
      USDC.toLowerCase(),
    );
    expect(decoded.message.value).toBe("1000000");
    expect(decoded.message.deadline).toBe("1800000000");
  });

  it("lança se não houver walletClient no contexto", async () => {
    await expect(
      signTypedData({ publicClient: {} } as unknown as ChainContext, PERMIT),
    ).rejects.toThrow("walletClient");
  });
});
