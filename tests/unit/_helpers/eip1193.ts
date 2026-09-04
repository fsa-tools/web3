// tests/unit/_helpers/eip1193.ts
import { createWalletClient, custom, type Chain } from "viem";
import { base } from "viem/chains";

export type RecordedRequest = { method: string; params?: unknown };

export type FakeProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  requests: RecordedRequest[];
};

const EXTENSION_ADDRESS =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;

/**
 * Provider EIP-1193 falso — o que a extensão do navegador entrega via EIP-6963.
 * Nunca vê chave privada: responde `eth_sendTransaction` / `eth_signTypedData_v4`
 * como se o usuário tivesse aprovado na UI da carteira.
 */
export function createFakeProvider(
  responses: Record<string, unknown> = {},
): FakeProvider {
  const requests: RecordedRequest[] = [];
  const defaults: Record<string, unknown> = {
    eth_accounts: [EXTENSION_ADDRESS],
    eth_requestAccounts: [EXTENSION_ADDRESS],
    eth_chainId: "0x2105",
    eth_sendTransaction: `0x${"11".repeat(32)}`,
    eth_signTypedData_v4: `0x${"22".repeat(65)}`,
  };
  return {
    requests,
    request: async ({ method, params }) => {
      requests.push({ method, params });
      const table = { ...defaults, ...responses };
      if (!(method in table)) throw new Error(`unstubbed method: ${method}`);
      return table[method];
    },
  };
}

/**
 * WalletClient nascido de `custom(provider)` — nenhum RPC de assinatura próprio,
 * nenhuma privateKey. É exatamente o que o Atlas injeta no ChainContext.
 */
export function createInjectedWalletClient(
  provider: FakeProvider,
  chain: Chain = base,
) {
  return createWalletClient({
    chain,
    transport: custom(provider),
    account: EXTENSION_ADDRESS,
  });
}

export { EXTENSION_ADDRESS };
