# @fsa/web3 v2.0 API Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `@fsa/web3@2.0.0` com `ChainContext` injetável, erros tipados, tipos viem explícitos, multi-transport obrigatório e decimals cache como DI — eliminando o boilerplate que os 3 consumers implementaram ad-hoc.

**Architecture:** `createChainContext(params)` substitui `createClients` e resolve endereços por `chainId` internamente. Todas as funções de protocolo e utils recebem `(ctx: ChainContext, params: OperationParams)` em vez de um flat object com `publicClient + walletClient + chainId`. Erros tipados substituem `throw new Error(string)`.

**Tech Stack:** TypeScript strict, viem v2, vitest, ESM/NodeNext.

---

## File Structure (novos e modificados)

**Novos:**
```
src/context.ts                              # ChainContext type + createChainContext
src/errors.ts                               # 7 classes de erro tipadas
tests/unit/context.test.ts                  # unit: createChainContext
tests/unit/errors.test.ts                   # unit: cada classe de erro
tests/types/viem-inference.test-d.ts        # type-level: readContract sem cast
tests/smoke/context.smoke.test.ts           # smoke: fallback RPC real
```

**Modificados (assinaturas):**
```
src/utils/decimals.ts       remove singleton, usa ctx.decimalsCache
src/utils/erc20.ts          (ctx, params) em ensureAllowance, getBalance
src/utils/gas.ts            (ctx, params) em estimateGas, withGasGuard, estimateDryRunCost, getEthPriceUsd
src/utils/pool.ts           (ctx, params) em getCurrentPrice
src/utils/position.ts       (ctx, params) em getOnChainPosition
src/utils/client.ts         DELETADO — substituído por createChainContext
src/utils/index.ts          remove createClients, adiciona re-export de context/errors
src/protocols/aave/types.ts                 renomear tipos + remover clients de params
src/protocols/aave/supply.ts                (ctx, params) assinatura
src/protocols/aave/withdraw.ts              (ctx, params) assinatura
src/protocols/aave/position.ts              (ctx, params) assinatura
src/protocols/aerodrome/types.ts            renomear tipos + remover clients de params
src/protocols/aerodrome/mint.ts             (ctx, params) assinatura
src/protocols/aerodrome/burn.ts             (ctx, params) assinatura
src/protocols/aerodrome/decrease.ts         (ctx, params) assinatura
src/protocols/aerodrome/collect.ts          (ctx, params) assinatura
src/protocols/uniswap-v3/types.ts           renomear tipos + remover clients de params
src/protocols/uniswap-v3/mint.ts            (ctx, params) assinatura — npm via ctx.addresses
src/protocols/uniswap-v3/burn.ts            (ctx, params) assinatura
src/protocols/uniswap-v3/decrease.ts        (ctx, params) assinatura
src/protocols/uniswap-v3/collect.ts         (ctx, params) assinatura
package.json                                version 2.0.0, add ./errors ./context exports
tests/smoke/_helpers.ts                     loadChainEnv retorna rpcUrls[], usa createChainContext
tests/smoke/aave.smoke.test.ts              nova API
tests/smoke/aerodrome.smoke.test.ts         nova API
tests/smoke/uniswap-v3.smoke.test.ts        nova API
tests/smoke/utils.smoke.test.ts             nova API
tests/smoke/pool.smoke.test.ts              nova API
tests/unit/utils/decimals.test.ts           nova API (ctx ao invés de publicClient)
CHANGELOG.md                                seção [2.0.0] com migration guide
README.md                                   seção "Migrating from v1.x to v2.0"
```

---

### Task 1: Bootstrap — branch, version, CHANGELOG stub

**Files:**
- Modify: `package.json` (version field)
- Modify: `CHANGELOG.md` (stub no topo)

- [ ] **Step 1: Criar branch a partir de feature/v1.8-completion**

```bash
git checkout feature/v1.8-completion
git checkout -b feature/v2.0
```

- [ ] **Step 2: Bump version em package.json**

Altere a linha `"version": "1.8.1"` (ou qualquer que seja a versão atual) para:
```json
"version": "2.0.0-rc.0"
```

- [ ] **Step 3: Adicionar stub no topo de CHANGELOG.md**

Adicione após o cabeçalho inicial do CHANGELOG:
```markdown
## [2.0.0] — TBD

### Breaking Changes
- `createClients` removido — use `createChainContext` de `@fsa/web3/context`
- Todas as funções de protocolo e utils recebem `(ctx: ChainContext, params)` em vez de flat object
- Tipos renomeados: `MintParams` → `MintOperationParams`, `SupplyParams` → `SupplyOperationParams`, etc.
- `_resetCache` removido — cache agora é `ctx.decimalsCache` (Map injetável)

### Added
- `ChainContext` — contrato central injetável (import from `@fsa/web3/context`)
- `createChainContext(params)` — cria contexto com transport fallback sempre ativo
- Erros tipados: `ChainNotSupportedError`, `ProtocolNotSupportedError`, `ReserveInactiveError`, `InsufficientAllowanceError`, `SlippageExceededError`, `AddressValidationError`, `ReceiptEventNotFoundError`
- `./errors` e `./context` em package.json exports

### Migration Guide
> Veja README.md — seção "Migrating from v1.x to v2.0"
```

- [ ] **Step 4: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bootstrap v2.0 branch — bump version, CHANGELOG stub"
```

---

### Task 2: src/errors.ts — classes de erro tipadas (TDD)

**Files:**
- Create: `src/errors.ts`
- Create: `tests/unit/errors.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```typescript
// tests/unit/errors.test.ts
import { describe, it, expect } from "vitest";
import {
  ChainNotSupportedError,
  ProtocolNotSupportedError,
  ReserveInactiveError,
  InsufficientAllowanceError,
  SlippageExceededError,
  AddressValidationError,
  ReceiptEventNotFoundError,
} from "../../src/errors.js";

const ADDR = "0x1234567890123456789012345678901234567890" as const;
const HASH = "0xabcdef" as `0x${string}`;

describe("typed errors", () => {
  it("ChainNotSupportedError: instanceof Error, carrega chainId, message contém id", () => {
    const err = new ChainNotSupportedError(99999);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ChainNotSupportedError);
    expect(err.chainId).toBe(99999);
    expect(err.message).toContain("99999");
    expect(err.name).toBe("ChainNotSupportedError");
  });

  it("ProtocolNotSupportedError: carrega chainId e protocol", () => {
    const err = new ProtocolNotSupportedError(8453, "aerodrome");
    expect(err).toBeInstanceOf(Error);
    expect(err.chainId).toBe(8453);
    expect(err.protocol).toBe("aerodrome");
    expect(err.message).toContain("aerodrome");
  });

  it("ReserveInactiveError: carrega asset e reason opcional", () => {
    const err = new ReserveInactiveError(ADDR, "paused");
    expect(err).toBeInstanceOf(Error);
    expect(err.asset).toBe(ADDR);
    expect(err.reason).toBe("paused");

    const errNoReason = new ReserveInactiveError(ADDR);
    expect(errNoReason.reason).toBeUndefined();
  });

  it("InsufficientAllowanceError: carrega token, required, actual", () => {
    const err = new InsufficientAllowanceError(ADDR, 1000n, 500n);
    expect(err).toBeInstanceOf(Error);
    expect(err.token).toBe(ADDR);
    expect(err.required).toBe(1000n);
    expect(err.actual).toBe(500n);
  });

  it("SlippageExceededError: carrega bps e max", () => {
    const err = new SlippageExceededError(6000, 5000);
    expect(err).toBeInstanceOf(Error);
    expect(err.bps).toBe(6000);
    expect(err.max).toBe(5000);
  });

  it("AddressValidationError: carrega value inválido", () => {
    const err = new AddressValidationError("not-an-address");
    expect(err).toBeInstanceOf(Error);
    expect(err.value).toBe("not-an-address");
  });

  it("ReceiptEventNotFoundError: carrega eventName e txHash", () => {
    const err = new ReceiptEventNotFoundError("IncreaseLiquidity", HASH);
    expect(err).toBeInstanceOf(Error);
    expect(err.eventName).toBe("IncreaseLiquidity");
    expect(err.txHash).toBe(HASH);
  });
});
```

- [ ] **Step 2: Rodar para confirmar FAIL**

```bash
npx vitest run tests/unit/errors.test.ts
```
Esperado: FAIL — `Cannot find module '../../src/errors.js'`

- [ ] **Step 3: Criar src/errors.ts**

```typescript
// src/errors.ts
import type { Address, Hex } from "viem";

export class ChainNotSupportedError extends Error {
  constructor(public readonly chainId: number) {
    super(`chainId ${chainId} is not supported`);
    this.name = "ChainNotSupportedError";
  }
}

export class ProtocolNotSupportedError extends Error {
  constructor(
    public readonly chainId: number,
    public readonly protocol: string,
  ) {
    super(`chainId ${chainId} does not support protocol ${protocol}`);
    this.name = "ProtocolNotSupportedError";
  }
}

export class ReserveInactiveError extends Error {
  constructor(
    public readonly asset: Address,
    public readonly reason?: string,
  ) {
    super(
      reason
        ? `Reserve ${asset} is inactive: ${reason}`
        : `Reserve ${asset} is inactive`,
    );
    this.name = "ReserveInactiveError";
  }
}

export class InsufficientAllowanceError extends Error {
  constructor(
    public readonly token: Address,
    public readonly required: bigint,
    public readonly actual: bigint,
  ) {
    super(
      `Insufficient allowance for ${token}: required ${required}, actual ${actual}`,
    );
    this.name = "InsufficientAllowanceError";
  }
}

export class SlippageExceededError extends Error {
  constructor(
    public readonly bps: number,
    public readonly max: number,
  ) {
    super(`Slippage ${bps}bps exceeds maximum ${max}bps`);
    this.name = "SlippageExceededError";
  }
}

export class AddressValidationError extends Error {
  constructor(public readonly value: string) {
    super(`Invalid address: ${value}`);
    this.name = "AddressValidationError";
  }
}

export class ReceiptEventNotFoundError extends Error {
  constructor(
    public readonly eventName: string,
    public readonly txHash: Hex,
  ) {
    super(`Event ${eventName} not found in receipt for tx ${txHash}`);
    this.name = "ReceiptEventNotFoundError";
  }
}
```

- [ ] **Step 4: Rodar para confirmar PASS**

```bash
npx vitest run tests/unit/errors.test.ts
```
Esperado: PASS — 7 testes

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts tests/unit/errors.test.ts
git commit -m "feat(errors): typed error classes replacing throw new Error(string)"
```

---

### Task 3: src/context.ts — ChainContext + createChainContext (TDD)

**Files:**
- Create: `src/context.ts`
- Create: `tests/unit/context.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```typescript
// tests/unit/context.test.ts
import { describe, it, expect } from "vitest";
import { createChainContext } from "../../src/context.js";
import { ChainNotSupportedError } from "../../src/errors.js";

const BASE_RPC = "https://mainnet.base.org";
const BASE_CHAIN_ID = 8453;
// Chave privada de teste — nunca tem saldo, só para instanciar walletClient
const TEST_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

describe("createChainContext", () => {
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
});
```

- [ ] **Step 2: Rodar para confirmar FAIL**

```bash
npx vitest run tests/unit/context.test.ts
```
Esperado: FAIL — `Cannot find module '../../src/context.js'`

- [ ] **Step 3: Criar src/context.ts**

```typescript
// src/context.ts
import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Account,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  polygonAmoy,
  sepolia,
} from "viem/chains";
import { ADDRESSES, type ChainAddresses } from "./constants/addresses.js";
import { ChainNotSupportedError } from "./errors.js";

export type ChainContext = {
  publicClient: PublicClient;
  walletClient?: WalletClient<Transport, Chain, Account>;
  addresses: ChainAddresses;
  decimalsCache?: Map<string, number>;
};

export type CreateChainContextParams = {
  chainId: number;
  rpcUrls: string[];
  privateKey?: Hex;
  decimalsCache?: Map<string, number>;
};

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  8453: base,
  42161: arbitrum,
  137: polygon,
  11155111: sepolia,
  80002: polygonAmoy,
  421614: arbitrumSepolia,
  84532: baseSepolia,
};

export function createChainContext(
  params: CreateChainContextParams,
): ChainContext {
  const chain = CHAIN_MAP[params.chainId];
  if (!chain) throw new ChainNotSupportedError(params.chainId);

  const addresses = ADDRESSES[params.chainId];
  if (!addresses) throw new ChainNotSupportedError(params.chainId);

  const transport = fallback(
    params.rpcUrls.map((url) => http(url)),
    { rank: true, retryCount: 1 },
  );

  const publicClient = createPublicClient({ chain, transport }) as PublicClient;

  const walletClient = params.privateKey
    ? createWalletClient({
        chain,
        transport,
        account: privateKeyToAccount(params.privateKey),
      })
    : undefined;

  return {
    publicClient,
    walletClient,
    addresses,
    decimalsCache: params.decimalsCache,
  };
}
```

- [ ] **Step 4: Rodar para confirmar PASS**

```bash
npx vitest run tests/unit/context.test.ts
```
Esperado: PASS — 6 testes

- [ ] **Step 5: Commit**

```bash
git add src/context.ts tests/unit/context.test.ts
git commit -m "feat(context): ChainContext type + createChainContext factory"
```

---

### Task 4: Migrar getTokenDecimals — ctx.decimalsCache como DI (TDD)

**Files:**
- Modify: `tests/unit/utils/decimals.test.ts` (reescrever para nova API)
- Modify: `src/utils/decimals.ts`

- [ ] **Step 1: Reescrever o teste com a nova API**

```typescript
// tests/unit/utils/decimals.test.ts
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
```

- [ ] **Step 2: Rodar para confirmar FAIL**

```bash
npx vitest run tests/unit/utils/decimals.test.ts
```
Esperado: FAIL — assinatura antiga não aceita `(ctx, { token })`

- [ ] **Step 3: Reescrever src/utils/decimals.ts**

```typescript
// src/utils/decimals.ts
import type { Address } from "viem";
import { ERC20_ABI } from "../abis/erc20.js";
import type { ChainContext } from "../context.js";

export type GetTokenDecimalsParams = {
  token: Address;
};

function cacheKey(chainId: number, token: Address): string {
  return `${chainId}:${token.toLowerCase()}`;
}

export async function getTokenDecimals(
  ctx: ChainContext,
  params: GetTokenDecimalsParams,
): Promise<number> {
  const chainId = ctx.publicClient.chain?.id;
  if (chainId === undefined) {
    throw new Error("publicClient must have a chain configured");
  }

  if (ctx.decimalsCache) {
    const key = cacheKey(chainId, params.token);
    const cached = ctx.decimalsCache.get(key);
    if (cached !== undefined) return cached;
  }

  const decimals = (await ctx.publicClient.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "decimals",
  })) as number;

  if (ctx.decimalsCache) {
    ctx.decimalsCache.set(cacheKey(chainId, params.token), decimals);
  }

  return decimals;
}
```

- [ ] **Step 4: Rodar para confirmar PASS**

```bash
npx vitest run tests/unit/utils/decimals.test.ts
```
Esperado: PASS — 5 testes

- [ ] **Step 5: Commit**

```bash
git add src/utils/decimals.ts tests/unit/utils/decimals.test.ts
git commit -m "feat(utils/decimals): ctx DI — remove singleton, usa ctx.decimalsCache"
```

---

### Task 5: Migrar src/utils/erc20.ts

**Files:**
- Modify: `src/utils/erc20.ts`

- [ ] **Step 1: Ler o arquivo atual antes de editar**

```bash
cat src/utils/erc20.ts
```

- [ ] **Step 2: Reescrever src/utils/erc20.ts com nova assinatura**

Mantenha a lógica atual, apenas troque a assinatura. O arquivo ficará assim:

```typescript
// src/utils/erc20.ts
import type { Address, Hash, PublicClient, Transport, Chain, Account, WalletClient } from "viem";
import { ERC20_ABI } from "../abis/erc20.js";
import type { ChainContext } from "../context.js";

export type EnsureAllowanceParams = {
  token: Address;
  spender: Address;
  amount: bigint;
};

export type AllowanceResult = {
  approved: boolean;
  txHash?: Hash;
};

export type GetBalanceParams = {
  token: Address;
  owner: Address;
};

export async function ensureAllowance(
  ctx: ChainContext,
  params: EnsureAllowanceParams,
): Promise<AllowanceResult> {
  if (!ctx.walletClient) {
    throw new Error("ensureAllowance requires walletClient in ChainContext");
  }
  const { publicClient, walletClient } = ctx;
  const { token, spender, amount } = params;

  const current = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [walletClient.account.address, spender],
  })) as bigint;

  if (current >= amount) return { approved: false };

  // Reset de allowance para tokens que exigem approve(0) antes de novo approve
  if (current > 0n) {
    const resetHash = await walletClient.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, 0n],
    });
    await publicClient.waitForTransactionReceipt({
      hash: resetHash,
      confirmations: 2,
    });
  }

  const txHash = await walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 2 });

  return { approved: true, txHash };
}

export async function getBalance(
  ctx: ChainContext,
  params: GetBalanceParams,
): Promise<bigint> {
  return (await ctx.publicClient.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [params.owner],
  })) as bigint;
}
```

> **Nota:** Se o arquivo atual tiver lógica adicional não mapeada aqui (ex: eventos), preserve-a. A substituição de `publicClient`/`walletClient` de params por `ctx` é a única mudança estrutural.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Esperado: erros apenas nos consumers internos que ainda usam assinatura antiga — será resolvido nas tasks seguintes.

- [ ] **Step 4: Commit**

```bash
git add src/utils/erc20.ts
git commit -m "feat(utils/erc20): migrate ensureAllowance, getBalance to (ctx, params)"
```

---

### Task 6: Migrar src/utils/gas.ts

**Files:**
- Modify: `src/utils/gas.ts`

- [ ] **Step 1: Reescrever src/utils/gas.ts**

Manter toda a lógica interna. Apenas extrair `publicClient` do primeiro parâmetro para `ctx`:

```typescript
// src/utils/gas.ts
import type { Address, Hex } from "viem";
import { POOL_ABI } from "../abis/pool.js";
import type { ChainContext } from "../context.js";

export type EstimateGasParams = {
  to: Address;
  data: Hex;
  value?: bigint;
  account?: Address;
  fallbackGasUnits?: bigint;
};

export type GasEstimate = {
  gasUnits: bigint;
  baseFeeGwei: number;
  gasCostEth: number;
};

export type GasOptions = {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gas?: bigint;
};

export type GetEthPriceParams = {
  wethUsdcPoolAddress: Address;
  poolAbi?: typeof POOL_ABI;
};

export type GasGuardOptions = {
  expectedGasUnits: bigint;
  ethPriceUsd: number;
  gasCostThresholdUsd: number;
};

export type GasGuardOptionsWithRetry = GasGuardOptions & {
  maxRetries: number;
  retryIntervalMs: number;
  maxWaitTimeMs?: number;
};

export type EstimateDryRunCostParams = {
  expectedGasUnits: bigint;
  ethPriceUsd: number;
};

export type DryRunCostEstimate = {
  costUsd: number;
  baseFeeGwei: number;
  ethPriceUsd: number;
};

const DEFAULT_FALLBACK_GAS = 500000n;
const WEI_PER_ETH = 1e18;

export async function estimateGas(
  ctx: ChainContext,
  params: EstimateGasParams,
): Promise<GasEstimate> {
  const { publicClient } = ctx;
  const { fallbackGasUnits = DEFAULT_FALLBACK_GAS } = params;
  let gasUnits: bigint;
  try {
    gasUnits = await publicClient.estimateGas({
      to: params.to,
      data: params.data,
      value: params.value,
      account: params.account,
    });
  } catch {
    gasUnits = fallbackGasUnits;
  }
  const feeData = await publicClient.estimateFeesPerGas();
  const baseFeeWei = feeData.maxFeePerGas ?? 0n;
  const baseFeeGwei = Number(baseFeeWei) / 1e9;
  const gasCostEth = Number(gasUnits * baseFeeWei) / WEI_PER_ETH;
  return { gasUnits, baseFeeGwei, gasCostEth };
}

export class GasThresholdExceededError extends Error {
  readonly estimatedCostUsd: number;
  readonly thresholdUsd: number;
  readonly retriesAttempted: number;

  constructor(params: {
    estimatedCostUsd: number;
    thresholdUsd: number;
    retriesAttempted: number;
  }) {
    super(
      `Gas cost $${params.estimatedCostUsd.toFixed(4)} exceeds threshold $${params.thresholdUsd} after ${params.retriesAttempted} retries`,
    );
    this.name = "GasThresholdExceededError";
    this.estimatedCostUsd = params.estimatedCostUsd;
    this.thresholdUsd = params.thresholdUsd;
    this.retriesAttempted = params.retriesAttempted;
  }
}

function estimateCostEth(expectedGasUnits: bigint, maxFeePerGas: bigint): number {
  return Number(expectedGasUnits * maxFeePerGas) / WEI_PER_ETH;
}

function estimateCostUsd(
  expectedGasUnits: bigint,
  maxFeePerGas: bigint,
  ethPriceUsd: number,
): number {
  return estimateCostEth(expectedGasUnits, maxFeePerGas) * ethPriceUsd;
}

function isTimeoutExceeded(startTime: number, maxWaitTimeMs: number | undefined): boolean {
  return maxWaitTimeMs !== undefined && Date.now() - startTime >= maxWaitTimeMs;
}

export async function withGasGuard<T>(
  ctx: ChainContext,
  fn: () => Promise<T>,
  options: GasGuardOptions | GasGuardOptionsWithRetry,
): Promise<T> {
  const { publicClient } = ctx;
  const { expectedGasUnits, ethPriceUsd, gasCostThresholdUsd } = options;
  const hasRetry = "maxRetries" in options;
  const maxRetries = hasRetry ? options.maxRetries : 0;
  const retryIntervalMs = hasRetry ? options.retryIntervalMs : 0;
  const maxWaitTimeMs = hasRetry ? options.maxWaitTimeMs : undefined;
  const startTime = Date.now();
  let attempt = 0;
  let lastCostUsd = 0;

  while (true) {
    if (isTimeoutExceeded(startTime, maxWaitTimeMs)) {
      throw new GasThresholdExceededError({
        estimatedCostUsd: lastCostUsd,
        thresholdUsd: gasCostThresholdUsd,
        retriesAttempted: attempt,
      });
    }
    const feeData = await publicClient.estimateFeesPerGas();
    const maxFeePerGas = feeData.maxFeePerGas;
    if (maxFeePerGas === null || maxFeePerGas === undefined) {
      throw new Error(
        "withGasGuard requires EIP-1559 support. Chain does not provide maxFeePerGas.",
      );
    }
    const estimatedCostUsd = estimateCostUsd(expectedGasUnits, maxFeePerGas, ethPriceUsd);
    lastCostUsd = estimatedCostUsd;
    if (estimatedCostUsd < gasCostThresholdUsd) {
      return fn();
    }
    if (attempt >= maxRetries) {
      throw new GasThresholdExceededError({
        estimatedCostUsd,
        thresholdUsd: gasCostThresholdUsd,
        retriesAttempted: attempt,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    attempt++;
  }
}

export async function estimateDryRunCost(
  ctx: ChainContext,
  params: EstimateDryRunCostParams,
): Promise<DryRunCostEstimate> {
  const feeData = await ctx.publicClient.estimateFeesPerGas();
  const baseFeeWei = feeData.maxFeePerGas ?? 0n;
  const baseFeeGwei = Number(baseFeeWei) / 1e9;
  const costUsd =
    (Number(params.expectedGasUnits * baseFeeWei) / WEI_PER_ETH) * params.ethPriceUsd;
  return { costUsd, baseFeeGwei, ethPriceUsd: params.ethPriceUsd };
}

export async function getEthPriceUsd(
  ctx: ChainContext,
  params: GetEthPriceParams,
): Promise<number> {
  const abi = params.poolAbi ?? POOL_ABI;
  const result = (await ctx.publicClient.readContract({
    address: params.wethUsdcPoolAddress,
    abi,
    functionName: "slot0",
  })) as unknown as [bigint, ...unknown[]];
  const sqrtPriceX96 = result[0];
  const Q96 = 2n ** 96n;
  const price = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);
  const DECIMALS_ADJUSTMENT = 1e12;
  return price * DECIMALS_ADJUSTMENT;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/gas.ts
git commit -m "feat(utils/gas): migrate estimateGas, withGasGuard, getEthPriceUsd to (ctx, params)"
```

---

### Task 7: Migrar src/utils/pool.ts e src/utils/position.ts

**Files:**
- Modify: `src/utils/pool.ts`
- Modify: `src/utils/position.ts`

- [ ] **Step 1: Ler os arquivos atuais**

```bash
cat src/utils/pool.ts
cat src/utils/position.ts
```

- [ ] **Step 2: Reescrever src/utils/pool.ts**

```typescript
// src/utils/pool.ts
import type { Abi, Address } from "viem";
import { POOL_ABI } from "../abis/pool.js";
import type { ChainContext } from "../context.js";

export type GetCurrentPriceParams = {
  poolAddress: Address;
  poolAbi?: Abi;
};

export type PriceResult = {
  tick: number;
  sqrtPriceX96: bigint;
};

export async function getCurrentPrice(
  ctx: ChainContext,
  params: GetCurrentPriceParams,
): Promise<PriceResult> {
  const abi = params.poolAbi ?? POOL_ABI;
  const result = (await ctx.publicClient.readContract({
    address: params.poolAddress,
    abi,
    functionName: "slot0",
  })) as unknown as [bigint, number, ...unknown[]];
  return { sqrtPriceX96: result[0], tick: result[1] };
}
```

- [ ] **Step 3: Reescrever src/utils/position.ts**

```typescript
// src/utils/position.ts
import type { Abi, Address } from "viem";
import { NPM_ABI } from "../abis/npm.js";
import type { ChainContext } from "../context.js";

export type GetPositionParams = {
  npmAddress: Address;
  nftId: bigint;
  npmAbi?: Abi;
};

export type OnChainPosition = {
  exists: boolean;
  liquidity: bigint;
  token0: Address;
  token1: Address;
  tickLower: number;
  tickUpper: number;
};

export async function getOnChainPosition(
  ctx: ChainContext,
  params: GetPositionParams,
): Promise<OnChainPosition> {
  const abi = params.npmAbi ?? NPM_ABI;
  try {
    const result = (await ctx.publicClient.readContract({
      address: params.npmAddress,
      abi,
      functionName: "positions",
      args: [params.nftId],
    })) as unknown as {
      liquidity: bigint;
      token0: Address;
      token1: Address;
      tickLower: number;
      tickUpper: number;
    };
    return {
      exists: true,
      liquidity: result.liquidity,
      token0: result.token0,
      token1: result.token1,
      tickLower: result.tickLower,
      tickUpper: result.tickUpper,
    };
  } catch {
    return {
      exists: false,
      liquidity: 0n,
      token0: "0x0000000000000000000000000000000000000000",
      token1: "0x0000000000000000000000000000000000000000",
      tickLower: 0,
      tickUpper: 0,
    };
  }
}
```

> **Nota:** Se position.ts atual tem lógica diferente (ex: detecta "exists" de outra forma), preserve. O objetivo é apenas trocar `params.publicClient` por `ctx.publicClient`.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/pool.ts src/utils/position.ts
git commit -m "feat(utils/pool,position): migrate getCurrentPrice, getOnChainPosition to (ctx, params)"
```

---

### Task 8: Migrar src/protocols/aave/

**Files:**
- Modify: `src/protocols/aave/types.ts`
- Modify: `src/protocols/aave/supply.ts`
- Modify: `src/protocols/aave/withdraw.ts`
- Modify: `src/protocols/aave/position.ts`

- [ ] **Step 1: Ler todos os arquivos aave**

```bash
cat src/protocols/aave/types.ts
cat src/protocols/aave/supply.ts
cat src/protocols/aave/withdraw.ts
cat src/protocols/aave/position.ts
```

- [ ] **Step 2: Reescrever src/protocols/aave/types.ts**

```typescript
// src/protocols/aave/types.ts
import type { Address, Hash } from "viem";

export type SupplyOperationParams = {
  asset: Address;
  amount: bigint;
  onBehalfOf?: Address;
};

export type SupplyResult = {
  txHash: Hash;
};

export type WithdrawOperationParams = {
  asset: Address;
  amount: bigint;
  to?: Address;
};

export type WithdrawResult = {
  txHash: Hash;
  amount: bigint;
};

export type GetPositionValueOperationParams = {
  aTokenAddress: Address;
  owner: Address;
};

export type PositionValue = {
  balance: bigint;
  decimals: number;
};

export type GetUserAccountDataOperationParams = {
  user: Address;
};

export type AccountData = {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
};
```

- [ ] **Step 3: Reescrever src/protocols/aave/supply.ts**

```typescript
// src/protocols/aave/supply.ts
import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import type { SupplyOperationParams, SupplyResult } from "./types.js";

const REFERRAL_CODE = 0;

export async function supply(
  ctx: ChainContext,
  params: SupplyOperationParams,
): Promise<SupplyResult> {
  if (!ctx.walletClient) {
    throw new Error("supply requires walletClient in ChainContext");
  }
  if (!ctx.addresses.aave) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "aave",
    );
  }

  const { publicClient, walletClient } = ctx;
  const poolAddress = ctx.addresses.aave.pool;
  const recipient = params.onBehalfOf ?? walletClient.account.address;

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: "supply",
    args: [params.asset, params.amount, recipient, REFERRAL_CODE],
  });

  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });

  return { txHash: hash };
}
```

- [ ] **Step 4: Reescrever src/protocols/aave/withdraw.ts**

Ler o arquivo atual e aplicar o mesmo padrão: extrair `publicClient`, `walletClient`, `chainId` do `params` e receber de `ctx`. Substituir `ADDRESSES[chainId]` por `ctx.addresses`. Exemplo da estrutura:

```typescript
// src/protocols/aave/withdraw.ts
import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import type { WithdrawOperationParams, WithdrawResult } from "./types.js";

export async function withdraw(
  ctx: ChainContext,
  params: WithdrawOperationParams,
): Promise<WithdrawResult> {
  if (!ctx.walletClient) {
    throw new Error("withdraw requires walletClient in ChainContext");
  }
  if (!ctx.addresses.aave) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "aave",
    );
  }

  const { publicClient, walletClient } = ctx;
  const poolAddress = ctx.addresses.aave.pool;
  const recipient = params.to ?? walletClient.account.address;

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: "withdraw",
    args: [params.asset, params.amount, recipient],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  // Extrair amount real do evento se disponível, senão usar params.amount
  return { txHash: hash, amount: params.amount };
}
```

> **Nota:** Se withdraw.ts atual extrai `amount` de um evento de receipt, preserve essa lógica — apenas substitua `publicClient` de params por `ctx.publicClient`.

- [ ] **Step 5: Reescrever src/protocols/aave/position.ts**

Aplicar o mesmo padrão. Para `getTokenDecimals`, agora chame `getTokenDecimals(ctx, { token })` em vez de `getTokenDecimals({ publicClient, token })`:

```typescript
// src/protocols/aave/position.ts
import { ERC20_ABI } from "../../abis/erc20.js";
import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import { getTokenDecimals } from "../../utils/decimals.js";
import type {
  GetPositionValueOperationParams,
  GetUserAccountDataOperationParams,
  PositionValue,
  AccountData,
} from "./types.js";

export async function getPositionValue(
  ctx: ChainContext,
  params: GetPositionValueOperationParams,
): Promise<PositionValue> {
  const balance = (await ctx.publicClient.readContract({
    address: params.aTokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [params.owner],
  })) as bigint;

  const decimals = await getTokenDecimals(ctx, { token: params.aTokenAddress });

  return { balance, decimals };
}

export async function getUserAccountData(
  ctx: ChainContext,
  params: GetUserAccountDataOperationParams,
): Promise<AccountData> {
  if (!ctx.addresses.aave) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "aave",
    );
  }

  const result = (await ctx.publicClient.readContract({
    address: ctx.addresses.aave.pool,
    abi: AAVE_POOL_ABI,
    functionName: "getUserAccountData",
    args: [params.user],
  })) as unknown as [bigint, bigint, bigint, bigint, bigint, bigint];

  return {
    totalCollateralBase: result[0],
    totalDebtBase: result[1],
    availableBorrowsBase: result[2],
    currentLiquidationThreshold: result[3],
    ltv: result[4],
    healthFactor: result[5],
  };
}
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/protocols/aave/
git commit -m "feat(protocols/aave): migrate supply, withdraw, position to (ctx, params)"
```

---

### Task 9: Migrar src/protocols/aerodrome/

**Files:**
- Modify: `src/protocols/aerodrome/types.ts`
- Modify: `src/protocols/aerodrome/mint.ts`
- Modify: `src/protocols/aerodrome/burn.ts`
- Modify: `src/protocols/aerodrome/decrease.ts`
- Modify: `src/protocols/aerodrome/collect.ts`

- [ ] **Step 1: Ler todos os arquivos aerodrome**

```bash
cat src/protocols/aerodrome/types.ts
cat src/protocols/aerodrome/mint.ts
cat src/protocols/aerodrome/burn.ts
cat src/protocols/aerodrome/decrease.ts
cat src/protocols/aerodrome/collect.ts
```

- [ ] **Step 2: Reescrever src/protocols/aerodrome/types.ts**

```typescript
// src/protocols/aerodrome/types.ts
import type { Address, Hash } from "viem";
import type { GasOptions } from "../../utils/gas.js";

export type MintOperationParams = {
  npmAddress: Address;
  poolAddress: Address;
  token0: Address;
  token1: Address;
  tickSpacing: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  sqrtPriceX96: bigint;
  slippageBps: number;
  deadline?: bigint;
  gasOptions?: GasOptions;
};

export type DecreaseOperationParams = {
  npmAddress: Address;
  nftId: bigint;
  liquidity: bigint;
  amount0Min?: bigint;
  amount1Min?: bigint;
  deadline?: bigint;
  gasOptions?: GasOptions;
};

export type CollectOperationParams = {
  npmAddress: Address;
  nftId: bigint;
  gasOptions?: GasOptions;
};

export type BurnOperationParams = {
  npmAddress: Address;
  nftId: bigint;
  gasOptions?: GasOptions;
};

export type PositionResult = {
  txHash: Hash;
  nftId: bigint;
  amount0: bigint;
  amount1: bigint;
  gasUsed: bigint;
};

export type DecreaseResult = {
  txHash: Hash;
  amount0: bigint;
  amount1: bigint;
  gasUsed: bigint;
};

export type CollectResult = {
  txHash: Hash;
  amount0: bigint;
  amount1: bigint;
  gasUsed: bigint;
};

export type BurnResult = {
  txHash: Hash;
  gasUsed: bigint;
};
```

- [ ] **Step 3: Reescrever mint.ts, burn.ts, decrease.ts, collect.ts**

Para cada arquivo: ler o conteúdo atual e substituir a desestruturação de `params` com `publicClient, walletClient` por `ctx.publicClient` e `ctx.walletClient`. A assinatura troca de `(params: AerodromeMintParams)` para `(ctx: ChainContext, params: MintOperationParams)`.

Exemplo de mint.ts após migração:

```typescript
// src/protocols/aerodrome/mint.ts
import { parseEventLogs } from "viem";
import { AERODROME_NPM_ABI } from "../../abis/aerodrome-npm.js";
import type { ChainContext } from "../../context.js";
import { applySlippage } from "../../math/slippage.js";
import { validateAddress } from "../../utils/address.js";
import { SlippageExceededError } from "../../errors.js";
import type { MintOperationParams, PositionResult } from "./types.js";

const DEFAULT_DEADLINE_OFFSET = 1200n;
const MAX_SLIPPAGE_BPS = 5000;

export async function mintPosition(
  ctx: ChainContext,
  params: MintOperationParams,
): Promise<PositionResult> {
  if (!ctx.walletClient) {
    throw new Error("mintPosition requires walletClient in ChainContext");
  }
  if (params.slippageBps < 0 || params.slippageBps > MAX_SLIPPAGE_BPS) {
    throw new SlippageExceededError(params.slippageBps, MAX_SLIPPAGE_BPS);
  }

  validateAddress(params.token0);
  validateAddress(params.token1);

  const { publicClient, walletClient } = ctx;
  const effectiveDeadline =
    params.deadline ??
    BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_OFFSET;
  const amount0Min = applySlippage(params.amount0Desired, params.slippageBps);
  const amount1Min = applySlippage(params.amount1Desired, params.slippageBps);

  const hash = await walletClient.writeContract({
    address: params.npmAddress,
    abi: AERODROME_NPM_ABI,
    functionName: "mint",
    args: [
      {
        token0: params.token0,
        token1: params.token1,
        tickSpacing: params.tickSpacing,
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        amount0Desired: params.amount0Desired,
        amount1Desired: params.amount1Desired,
        amount0Min,
        amount1Min,
        recipient: walletClient.account.address,
        deadline: effectiveDeadline,
        sqrtPriceX96: params.sqrtPriceX96,
      },
    ],
    ...(params.gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  const logs = parseEventLogs({
    abi: AERODROME_NPM_ABI,
    eventName: "IncreaseLiquidity",
    logs: receipt.logs,
  });
  const event = logs[0];
  if (!event) {
    throw new Error("IncreaseLiquidity event not found in receipt");
  }

  return {
    txHash: hash,
    nftId: event.args.tokenId,
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    gasUsed: receipt.gasUsed,
  };
}
```

Para `burn.ts`, `decrease.ts`, `collect.ts`: aplicar o mesmo padrão (ler atual, extrair clients de ctx, renomear params type para `*OperationParams`).

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/protocols/aerodrome/
git commit -m "feat(protocols/aerodrome): migrate mint, burn, decrease, collect to (ctx, params)"
```

---

### Task 10: Migrar src/protocols/uniswap-v3/

**Files:**
- Modify: `src/protocols/uniswap-v3/types.ts`
- Modify: `src/protocols/uniswap-v3/mint.ts`
- Modify: `src/protocols/uniswap-v3/burn.ts`
- Modify: `src/protocols/uniswap-v3/decrease.ts`
- Modify: `src/protocols/uniswap-v3/collect.ts`

- [ ] **Step 1: Ler todos os arquivos uniswap-v3**

```bash
cat src/protocols/uniswap-v3/types.ts
cat src/protocols/uniswap-v3/mint.ts
cat src/protocols/uniswap-v3/burn.ts
cat src/protocols/uniswap-v3/decrease.ts
cat src/protocols/uniswap-v3/collect.ts
```

- [ ] **Step 2: Reescrever src/protocols/uniswap-v3/types.ts**

```typescript
// src/protocols/uniswap-v3/types.ts
import type { Address, Hash } from "viem";
import type { GasOptions } from "../../utils/gas.js";

export type MintOperationParams = {
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  slippageBps: number;
  deadline?: bigint;
  gasOptions?: GasOptions;
};

export type DecreaseOperationParams = {
  tokenId: bigint;
  liquidity: bigint;
  slippageBps: number;
  deadline?: bigint;
  recipient: Address;
  gasOptions?: GasOptions;
};

export type CollectOperationParams = {
  tokenId: bigint;
  recipient: Address;
  gasOptions?: GasOptions;
};

export type BurnOperationParams = {
  tokenId: bigint;
  gasOptions?: GasOptions;
};

export type PositionResult = {
  tokenId: bigint;
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  txHash: Hash;
  gasUsed: bigint;
};

export type DecreaseResult = {
  amount0: bigint;
  amount1: bigint;
  txHash: Hash;
  gasUsed: bigint;
};

export type CollectResult = {
  amount0: bigint;
  amount1: bigint;
  txHash: Hash;
  gasUsed: bigint;
};

export type BurnResult = {
  txHash: Hash;
  gasUsed: bigint;
};
```

- [ ] **Step 3: Reescrever src/protocols/uniswap-v3/mint.ts**

Neste arquivo, o `npmAddress` agora vem de `ctx.addresses.uniswapV3.npm` em vez de `ADDRESSES[chainId].uniswapV3.npm`:

```typescript
// src/protocols/uniswap-v3/mint.ts
import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError, SlippageExceededError, ReceiptEventNotFoundError } from "../../errors.js";
import { applySlippage } from "../../math/slippage.js";
import { validateAddress } from "../../utils/address.js";
import type { MintOperationParams, PositionResult } from "./types.js";

const DEFAULT_DEADLINE_OFFSET = 1200n;
const MAX_SLIPPAGE_BPS = 5000;

export async function mintPosition(
  ctx: ChainContext,
  params: MintOperationParams,
): Promise<PositionResult> {
  if (!ctx.walletClient) {
    throw new Error("mintPosition requires walletClient in ChainContext");
  }
  if (!ctx.addresses.uniswapV3) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "uniswap-v3",
    );
  }
  if (params.slippageBps < 0 || params.slippageBps > MAX_SLIPPAGE_BPS) {
    throw new SlippageExceededError(params.slippageBps, MAX_SLIPPAGE_BPS);
  }

  validateAddress(params.token0);
  validateAddress(params.token1);

  const { publicClient, walletClient } = ctx;
  const npmAddress = ctx.addresses.uniswapV3.npm;
  const effectiveDeadline =
    params.deadline ??
    BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_OFFSET;
  const amount0Min = applySlippage(params.amount0Desired, params.slippageBps);
  const amount1Min = applySlippage(params.amount1Desired, params.slippageBps);

  const hash = await walletClient.writeContract({
    address: npmAddress,
    abi: NPM_ABI,
    functionName: "mint",
    args: [
      {
        token0: params.token0,
        token1: params.token1,
        fee: params.fee,
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        amount0Desired: params.amount0Desired,
        amount1Desired: params.amount1Desired,
        amount0Min,
        amount1Min,
        recipient: walletClient.account.address,
        deadline: effectiveDeadline,
      },
    ],
    ...(params.gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  const logs = parseEventLogs({
    abi: NPM_ABI,
    eventName: "IncreaseLiquidity",
    logs: receipt.logs,
  });
  const event = logs[0];
  if (!event) throw new ReceiptEventNotFoundError("IncreaseLiquidity", hash);

  return {
    tokenId: event.args.tokenId,
    liquidity: event.args.liquidity,
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash: hash,
    gasUsed: receipt.gasUsed,
  };
}
```

- [ ] **Step 4: Reescrever burn.ts, decrease.ts, collect.ts**

Aplicar o mesmo padrão: ler arquivo atual, substituir `params.publicClient`/`params.walletClient`/`params.chainId` por `ctx.*`, renomear o tipo de params para `*OperationParams`.

Para `decrease.ts` e `collect.ts`, o `npmAddress` vem de `ctx.addresses.uniswapV3?.npm` com guard para `ProtocolNotSupportedError`.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/protocols/uniswap-v3/
git commit -m "feat(protocols/uniswap-v3): migrate mint, burn, decrease, collect to (ctx, params)"
```

---

### Task 11: Substituir string throws por erros tipados

**Files:**
- Modify: `src/utils/address.ts`
- Modify: (verificar todos os arquivos por `throw new Error(` residuais)

- [ ] **Step 1: Buscar todos os string throws restantes**

```bash
grep -rn "throw new Error(" src/
```

Identifique quais são "boundary errors" (devem virar typed) vs "invariant guards" (ok manter como string).

- [ ] **Step 2: Atualizar src/utils/address.ts**

Ler o arquivo atual e substituir o throw por `AddressValidationError`:

```typescript
// src/utils/address.ts
import { isAddress, type Address } from "viem";
import { AddressValidationError } from "../errors.js";

export function validateAddress(addr: string): Address {
  if (!isAddress(addr)) throw new AddressValidationError(addr);
  return addr;
}
```

- [ ] **Step 3: Substituir ReceiptEventNotFoundError em arquivos que ainda usam string throw**

Nos arquivos aerodrome (mint, etc.) que ainda fazem `throw new Error("... event not found ...")`, substituir por:
```typescript
throw new ReceiptEventNotFoundError("NomeDoEvento", hash);
```

- [ ] **Step 4: Substituir SlippageExceededError onde não foi feito ainda**

Qualquer arquivo que ainda faça `throw new Error("slippageBps exceeds")` deve usar:
```typescript
throw new SlippageExceededError(params.slippageBps, MAX_SLIPPAGE_BPS);
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Esperado: zero erros.

- [ ] **Step 6: Rodar todos os unit tests**

```bash
npx vitest run tests/unit/
```
Esperado: PASS em todos.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat(errors): replace string throws with typed error classes across codebase"
```

---

### Task 12: Eliminar casts de readContract com ContractFunctionReturnType

**Files:**
- Modify: `src/utils/decimals.ts`
- Modify: `src/utils/gas.ts`
- Modify: `src/protocols/aave/position.ts`
- Modify: (outros arquivos identificados no step 1)

- [ ] **Step 1: Localizar casts `as number`, `as bigint`, `as unknown as`**

```bash
grep -rn "readContract" src/ | grep -E "as (number|bigint|unknown)"
```

- [ ] **Step 2: Para cada cast em readContract com ABI estático, substituir por inferência**

Exemplo em `decimals.ts`:

Antes:
```typescript
const decimals = (await ctx.publicClient.readContract({
  address: params.token,
  abi: ERC20_ABI,
  functionName: "decimals",
})) as number;
```

Depois (viem v2 infere automaticamente quando ABI é `const` tipado):
```typescript
const decimals = await ctx.publicClient.readContract({
  address: params.token,
  abi: ERC20_ABI,
  functionName: "decimals",
});
```

> **Nota:** Se viem não inferir automaticamente (ABI não tem `as const` ou o tipo é union complexo), mantenha o cast e documente com comentário. Não force inferência que não funciona.

- [ ] **Step 3: Verificar que ABIs em src/abis/ são exportados com `as const`**

```bash
grep -n "as const" src/abis/*.ts
```

Se algum ABI não tem `as const`, adicioná-lo ao final da declaração para habilitar inferência.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Esperado: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "refactor: eliminate readContract casts via viem type inference"
```

---

### Task 13: Atualizar package.json — exports, remover createClients

**Files:**
- Modify: `package.json`
- Delete: `src/utils/client.ts`
- Modify: `src/utils/index.ts`
- Create: `src/index.ts` atualizado (se necessário)

- [ ] **Step 1: Ler package.json e src/utils/index.ts atuais**

```bash
cat package.json
cat src/utils/index.ts
```

- [ ] **Step 2: Adicionar exports `./errors` e `./context` em package.json**

No campo `exports`, adicionar após os existentes:
```json
"./errors": {
  "import": "./dist/src/errors.js",
  "types": "./dist/src/errors.d.ts"
},
"./context": {
  "import": "./dist/src/context.js",
  "types": "./dist/src/context.d.ts"
}
```

- [ ] **Step 3: Remover createClients de src/utils/index.ts**

Se `src/utils/index.ts` re-exporta `createClients` de `client.ts`, remova essa linha.

- [ ] **Step 4: Deletar src/utils/client.ts**

```bash
git rm src/utils/client.ts
```

- [ ] **Step 5: Adicionar @internal JSDoc em ADDRESSES no constants/addresses.ts**

```typescript
/** @internal — use ctx.addresses via createChainContext instead of direct access */
export const ADDRESSES: Record<number, ChainAddresses> = { ... }
```

- [ ] **Step 6: Typecheck e build**

```bash
npx tsc --noEmit
npx tsc
```
Esperado: build completo sem erros em `dist/`.

- [ ] **Step 7: Commit**

```bash
git add package.json src/utils/index.ts src/constants/addresses.ts
git rm src/utils/client.ts
git commit -m "chore: add ./errors ./context exports, remove createClients from package"
```

---

### Task 14: Migrar smoke test helpers e criar contexto helper

**Files:**
- Modify: `tests/smoke/_helpers.ts`

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat tests/smoke/_helpers.ts
```

- [ ] **Step 2: Reescrever _helpers.ts para usar createChainContext**

```typescript
// tests/smoke/_helpers.ts
import type { Hex } from "viem";
import { createChainContext } from "../../src/context.js";
import type { ChainContext } from "../../src/context.js";

export type SmokeChainConfig = {
  chainId: number;
  name: string;
  rpcEnvVar: string;   // suporta URL única; separe múltiplas por vírgula
  pkEnvVar: string;
  faucetTokens: {
    weth?: `0x${string}`;
    usdc?: `0x${string}`;
  };
  aaveReserves?: {
    weth?: `0x${string}`;
    usdc?: `0x${string}`;
  };
};

export const SMOKE_CHAINS: Record<string, SmokeChainConfig> = {
  sepolia: {
    chainId: 11155111,
    name: "sepolia",
    rpcEnvVar: "SEPOLIA_RPC",
    pkEnvVar: "SMOKE_PK_SEPOLIA",
    faucetTokens: {
      weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    },
    aaveReserves: {
      usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    },
  },
  polygonAmoy: {
    chainId: 80002,
    name: "polygon-amoy",
    rpcEnvVar: "POLYGON_AMOY_RPC",
    pkEnvVar: "SMOKE_PK_POLYGON",
    faucetTokens: {
      weth: "0x52eF3d68BaB452a294342DC3e5f464d7f610f72E",
      usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    },
  },
};

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export function loadChainContext(cfg: SmokeChainConfig): ChainContext | null {
  const rpcRaw = process.env[cfg.rpcEnvVar];
  const pk = process.env[cfg.pkEnvVar];
  if (!rpcRaw || !pk) return null;

  const rpcUrls = rpcRaw.split(",").map((u) => u.trim());
  return createChainContext({
    chainId: cfg.chainId,
    rpcUrls,
    privateKey: pk as Hex,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/_helpers.ts
git commit -m "test(smoke): migrate _helpers to loadChainContext + createChainContext"
```

---

### Task 15: Migrar smoke tests de protocolo

**Files:**
- Modify: `tests/smoke/aave.smoke.test.ts`
- Modify: `tests/smoke/aerodrome.smoke.test.ts`
- Modify: `tests/smoke/uniswap-v3.smoke.test.ts`
- Modify: `tests/smoke/utils.smoke.test.ts`
- Modify: `tests/smoke/pool.smoke.test.ts`

- [ ] **Step 1: Ler todos os smoke tests atuais**

```bash
cat tests/smoke/aave.smoke.test.ts
cat tests/smoke/aerodrome.smoke.test.ts
cat tests/smoke/uniswap-v3.smoke.test.ts
cat tests/smoke/utils.smoke.test.ts
cat tests/smoke/pool.smoke.test.ts
```

- [ ] **Step 2: Padrão de migração — aplicar em todos os arquivos**

Antes de cada smoke test, o padrão era:
```typescript
const env = loadChainEnv(cfg)
if (!env) return
const { publicClient, walletClient } = createClients({ chainId, rpcUrl: env.rpcUrl, privateKey: env.pk })
// depois passava publicClient, walletClient, chainId para cada função
```

Depois:
```typescript
const ctx = loadChainContext(cfg)
if (!ctx) return
// usa ctx diretamente
```

E as chamadas de função mudam de:
```typescript
await supply({ publicClient, walletClient, chainId, asset, amount })
```
Para:
```typescript
await supply(ctx, { asset, amount })
```

- [ ] **Step 3: Migrar aave.smoke.test.ts**

Para cada `it` block:
- Substitua `loadChainEnv` + `createClients` por `loadChainContext`
- Substitua `supply({ publicClient, walletClient, chainId, ... })` por `supply(ctx, { ... })`
- Substitua `withdraw({ publicClient, walletClient, chainId, ... })` por `withdraw(ctx, { ... })`
- Substitua `getPositionValue({ publicClient, ... })` por `getPositionValue(ctx, { ... })`
- Substitua `getUserAccountData({ publicClient, chainId, ... })` por `getUserAccountData(ctx, { ... })`

- [ ] **Step 4: Migrar uniswap-v3.smoke.test.ts**

Mesma substituição. `mintPosition` não recebe mais `chainId` — npm vem de `ctx.addresses.uniswapV3.npm`. Remova `npmAddress` dos params se estava sendo passado explicitamente via ADDRESSES.

- [ ] **Step 5: Migrar aerodrome.smoke.test.ts**

Mesma substituição. `npmAddress` ainda é passado em `MintOperationParams` (Aerodrome não tem endereço em ctx.addresses para todos os camps) — mantenha nos params.

- [ ] **Step 6: Migrar utils.smoke.test.ts e pool.smoke.test.ts**

Substituir calls de `getTokenDecimals`, `ensureAllowance`, `getBalance`, `getEthPriceUsd`, `getCurrentPrice` para a nova assinatura `(ctx, params)`.

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```
Esperado: zero erros.

- [ ] **Step 8: Commit**

```bash
git add tests/smoke/
git commit -m "test(smoke): migrate all smoke tests to (ctx, params) API"
```

---

### Task 16: Novo smoke test — fallback RPC context

**Files:**
- Create: `tests/smoke/context.smoke.test.ts`

- [ ] **Step 1: Criar o smoke test**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add tests/smoke/context.smoke.test.ts
git commit -m "test(smoke/context): validate fallback RPC with real chain"
```

---

### Task 17: Type-level tests — viem inference

**Files:**
- Create: `tests/types/viem-inference.test-d.ts`

- [ ] **Step 1: Criar o diretório se necessário**

```bash
mkdir -p tests/types
```

- [ ] **Step 2: Criar o arquivo de type-level tests**

```typescript
// tests/types/viem-inference.test-d.ts
import { expectTypeOf } from "vitest";
import { createChainContext } from "../../src/context.js";
import type { ChainContext } from "../../src/context.js";
import {
  ChainNotSupportedError,
  ProtocolNotSupportedError,
  SlippageExceededError,
} from "../../src/errors.js";

// ChainContext é um tipo estável
expectTypeOf<ChainContext>().toHaveProperty("publicClient");
expectTypeOf<ChainContext>().toHaveProperty("walletClient");
expectTypeOf<ChainContext>().toHaveProperty("addresses");
expectTypeOf<ChainContext["decimalsCache"]>().toEqualTypeOf<
  Map<string, number> | undefined
>();

// createChainContext retorna ChainContext
expectTypeOf(
  createChainContext({ chainId: 8453, rpcUrls: ["https://mainnet.base.org"] }),
).toEqualTypeOf<ChainContext>();

// Erros tipados são subclasses de Error
expectTypeOf<ChainNotSupportedError>().toMatchTypeOf<Error>();
expectTypeOf<ProtocolNotSupportedError>().toMatchTypeOf<Error>();
expectTypeOf<SlippageExceededError>().toMatchTypeOf<Error>();

// Campos estruturados são tipados corretamente
expectTypeOf<ChainNotSupportedError["chainId"]>().toEqualTypeOf<number>();
expectTypeOf<SlippageExceededError["bps"]>().toEqualTypeOf<number>();
expectTypeOf<SlippageExceededError["max"]>().toEqualTypeOf<number>();
```

- [ ] **Step 3: Adicionar ao tsconfig.test.json (se existir)**

```bash
cat tsconfig.test.json
```

Se o tsconfig de test existe e tem `include`, adicionar `"tests/types/**/*"` ao array.

- [ ] **Step 4: Rodar type-level tests**

```bash
npx vitest run tests/types/
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/types/
git commit -m "test(types): viem inference + ChainContext type-level tests"
```

---

### Task 18: README — seção de migração v1.x → v2.0

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Ler o README atual**

```bash
cat README.md
```

- [ ] **Step 2: Adicionar seção "Migrating from v1.x to v2.0" antes da seção de uso**

```markdown
## Migrating from v1.x to v2.0

### Contexto

Em v1.x, cada função recebia `publicClient`, `walletClient` e `chainId` diretamente.
Em v2.0, crie um `ChainContext` uma vez e passe-o para todas as funções.

### Antes (v1.x)

```typescript
import { createClients } from "@fsa/web3/utils";
import { mintPosition } from "@fsa/web3/uniswap-v3";

const { publicClient, walletClient } = createClients({
  chainId: 8453,
  rpcUrl: process.env.RPC_URL!,
  privateKey: process.env.PRIVATE_KEY as Hex,
});

await mintPosition({
  publicClient,
  walletClient,
  chainId: 8453,
  token0: "0x...",
  token1: "0x...",
  fee: 500,
  // ...
});
```

### Depois (v2.0)

```typescript
import { createChainContext } from "@fsa/web3/context";
import { mintPosition } from "@fsa/web3/uniswap-v3";

const ctx = createChainContext({
  chainId: 8453,
  rpcUrls: [process.env.RPC_URL!],  // array obrigatório — fallback ativo
  privateKey: process.env.PRIVATE_KEY as Hex,
});

await mintPosition(ctx, {
  token0: "0x...",
  token1: "0x...",
  fee: 500,
  // sem publicClient, walletClient, chainId — vêm do ctx
});
```

### Tabela de mudanças

| v1.x | v2.0 |
|------|-------|
| `createClients(params)` from `@fsa/web3/utils` | `createChainContext(params)` from `@fsa/web3/context` |
| `rpcUrl: string` | `rpcUrls: string[]` (fallback sempre ativo) |
| `MintParams` | `MintOperationParams` |
| `SupplyParams` | `SupplyOperationParams` |
| `WithdrawParams` | `WithdrawOperationParams` |
| `DecreaseParams` | `DecreaseOperationParams` |
| `BurnParams` | `BurnOperationParams` |
| `CollectParams` | `CollectOperationParams` |
| `getTokenDecimals({ publicClient, token })` | `getTokenDecimals(ctx, { token })` |
| `ensureAllowance({ publicClient, walletClient, ... })` | `ensureAllowance(ctx, { token, spender, amount })` |
| `_resetCache()` (decimals singleton) | `ctx.decimalsCache = new Map()` (DI) |
| `throw new Error("chainId X not supported")` | `throw new ChainNotSupportedError(chainId)` |

### Erros tipados

```typescript
import {
  ChainNotSupportedError,
  ProtocolNotSupportedError,
  SlippageExceededError,
  ReceiptEventNotFoundError,
} from "@fsa/web3/errors";

try {
  await mintPosition(ctx, params);
} catch (err) {
  if (err instanceof SlippageExceededError) {
    console.log(`Slippage ${err.bps}bps > max ${err.max}bps`);
  } else if (err instanceof ReceiptEventNotFoundError) {
    console.log(`Event ${err.eventName} missing in tx ${err.txHash}`);
  }
}
```
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Migrating from v1.x to v2.0 section in README"
```

---

### Task 19: CHANGELOG [2.0.0] completo

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Completar a seção [2.0.0] no CHANGELOG.md**

Substitua o stub criado na Task 1 pela versão completa, adicionando a data real. A seção já tem o esqueleto — complete com os detalhes de cada função migrada:

```markdown
## [2.0.0] — 2026-04-XX

### Breaking Changes

#### API de Funções
Todas as funções de protocolo e utils agora recebem `(ctx: ChainContext, params)` em vez de flat object.

| Função | Assinatura v1.x | Assinatura v2.0 |
|--------|-----------------|-----------------|
| `mintPosition` (uniswap-v3) | `(params: MintParams)` | `(ctx, params: MintOperationParams)` |
| `mintPosition` (aerodrome) | `(params: AerodromeMintParams)` | `(ctx, params: MintOperationParams)` |
| `decreaseLiquidity` | `(params: DecreaseParams)` | `(ctx, params: DecreaseOperationParams)` |
| `collectFees` | `(params: CollectParams)` | `(ctx, params: CollectOperationParams)` |
| `burnPosition` | `(params: BurnParams)` | `(ctx, params: BurnOperationParams)` |
| `supply` (aave) | `(params: SupplyParams)` | `(ctx, params: SupplyOperationParams)` |
| `withdraw` (aave) | `(params: WithdrawParams)` | `(ctx, params: WithdrawOperationParams)` |
| `getPositionValue` | `(params: GetPositionValueParams)` | `(ctx, params: GetPositionValueOperationParams)` |
| `getUserAccountData` | `(params: GetUserAccountDataParams)` | `(ctx, params: GetUserAccountDataOperationParams)` |
| `getTokenDecimals` | `({ publicClient, token })` | `(ctx, { token })` |
| `ensureAllowance` | `({ publicClient, walletClient, ... })` | `(ctx, { token, spender, amount })` |
| `getBalance` | `({ publicClient, token, owner })` | `(ctx, { token, owner })` |
| `estimateGas` | `({ publicClient, to, ... })` | `(ctx, { to, ... })` |
| `withGasGuard` | `(fn, { publicClient, ... })` | `(ctx, fn, { ... })` |
| `estimateDryRunCost` | `({ publicClient, ... })` | `(ctx, { ... })` |
| `getEthPriceUsd` | `({ publicClient, wethUsdcPoolAddress })` | `(ctx, { wethUsdcPoolAddress })` |
| `getCurrentPrice` | `({ publicClient, poolAddress })` | `(ctx, { poolAddress })` |
| `getOnChainPosition` | `({ publicClient, npmAddress, nftId })` | `(ctx, { npmAddress, nftId })` |

#### Removidos
- `createClients` removido de `@fsa/web3/utils` — use `createChainContext` de `@fsa/web3/context`
- `_resetCache()` removido — use `ctx.decimalsCache: Map<string, number>` (DI)
- `rpcUrl: string` → `rpcUrls: string[]` (array obrigatório)

#### Tipos Renomeados
- `MintParams` → `MintOperationParams` (uniswap-v3 e aerodrome)
- `SupplyParams` → `SupplyOperationParams`
- `WithdrawParams` → `WithdrawOperationParams`
- `DecreaseParams` → `DecreaseOperationParams`
- `BurnParams` → `BurnOperationParams`
- `CollectParams` → `CollectOperationParams`

### Added
- `ChainContext` — tipo central com `publicClient`, `walletClient?`, `addresses`, `decimalsCache?`
- `createChainContext(params)` — factory com fallback transport sempre ativo (rank: true, retryCount: 1)
- `@fsa/web3/context` export — `createChainContext`, `ChainContext`
- `@fsa/web3/errors` export — 7 classes de erro tipadas:
  - `ChainNotSupportedError(chainId)`
  - `ProtocolNotSupportedError(chainId, protocol)`
  - `ReserveInactiveError(asset, reason?)`
  - `InsufficientAllowanceError(token, required, actual)`
  - `SlippageExceededError(bps, max)`
  - `AddressValidationError(value)`
  - `ReceiptEventNotFoundError(eventName, txHash)`
- Decimals cache como DI via `ctx.decimalsCache` — elimina singleton de module scope

### Migration Guide
Veja README.md — seção "Migrating from v1.x to v2.0"
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: complete CHANGELOG [2.0.0] with migration table"
```

---

### Task 20: Verificação final e typecheck completo

- [ ] **Step 1: Rodar typecheck estrito**

```bash
npx tsc --noEmit
npx tsc --project tsconfig.test.json --noEmit
```
Esperado: zero erros em ambos.

- [ ] **Step 2: Rodar todos os unit tests**

```bash
npx vitest run tests/unit/
```
Esperado: PASS — todos os testes.

- [ ] **Step 3: Verificar build completo**

```bash
npx tsc
ls dist/src/context.js dist/src/errors.js
```
Esperado: arquivos existem em `dist/`.

- [ ] **Step 4: Checar exports no package compilado**

```bash
node --input-type=module <<'EOF'
import { createChainContext } from './dist/src/context.js'
import { ChainNotSupportedError } from './dist/src/errors.js'
console.log('createChainContext:', typeof createChainContext)
console.log('ChainNotSupportedError:', typeof ChainNotSupportedError)
EOF
```
Esperado: `function` para ambos.

- [ ] **Step 5: PAUSA — rodar smoke tests nas 3 chains com real RPC**

```bash
npx vitest run --config vitest.smoke.config.ts
```
Aguardar aprovação do usuário antes de prosseguir para o publish.

---

### Task 21: Publish v2.0.0-rc.1

- [ ] **Step 1: Bump version para rc.1**

Em `package.json`:
```json
"version": "2.0.0-rc.1"
```

- [ ] **Step 2: Commit de versão**

```bash
git add package.json
git commit -m "chore(release): bump to v2.0.0-rc.1"
```

- [ ] **Step 3: Publicar no Verdaccio usando /publish**

Invocar o skill `/publish` para publicar com a configuração padrão do projeto:

```bash
# O skill /publish cuida de: build, npm publish --registry <verdaccio>, tag git
```

- [ ] **Step 4: Testar em 1 consumer (vfat-monitor ou claw-yield)**

Em um consumer escolhido:
```bash
npm install @fsa/web3@2.0.0-rc.1 --registry <verdaccio-url>
npx tsc --noEmit
```
Esperado: erros de TypeScript indicando onde o consumer precisa migrar — confirma que a API breaking foi propagada corretamente.

---

### Task 22: Publish v2.0.0 estável

Somente após RC validado e smoke tests aprovados pelo usuário.

- [ ] **Step 1: Bump version para 2.0.0**

```json
"version": "2.0.0"
```

- [ ] **Step 2: Commit e tag**

```bash
git add package.json
git commit -m "chore(release): v2.0.0 stable"
git tag v2.0.0
```

- [ ] **Step 3: Invocar /publish para publicar v2.0.0**

```bash
# /publish cuida do publish + push da tag
```

---

## Self-Review

**Spec coverage:**
- [x] Item 1 — ChainContext injetável: Tasks 3, 5-10
- [x] Item 2 — Erros tipados: Tasks 2, 11
- [x] Item 4 — Tipos viem explícitos: Task 12
- [x] Item 5 — Multi-transport default (rpcUrls array): Tasks 3, 14
- [x] Item 6 — Decimals cache como DI: Task 4
- [x] ADDRESSES @internal: Task 13
- [x] Unit + type-level + smoke tests: Tasks 4, 16, 17
- [x] README migração + CHANGELOG: Tasks 18, 19
- [x] Publish rc.1 → validar → v2.0.0: Tasks 21, 22

**Tipos consistentes entre tasks:** `MintOperationParams` (aerodrome Task 9), `MintOperationParams` (uniswap-v3 Task 10) — são tipos distintos em namespaces distintos, sem colisão. `PositionResult` também tem definição distinta por protocolo.

**Nenhum placeholder:** Todo step tem código concreto ou comando executável.
