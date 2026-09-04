# @fsa-tools/web3

Shared Web3 utilities para bots DeFi do portfólio: viem clients, ERC20 helpers, wrappers de Uniswap V3, Aerodrome e Aave V3.

## Install

```bash
npm install @fsa-tools/web3
```

Requer `.npmrc` apontando pro GitHub Packages:

```
@fsa-tools:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

`NODE_AUTH_TOKEN` é um Personal Access Token com escopo `read:packages`.

## Uso

```typescript
import { createChainContext } from "@fsa-tools/web3/context";
import { mintPosition } from "@fsa-tools/web3/uniswap-v3";
import type { Hex } from "viem";

const ctx = createChainContext({
  chainId: 8453,
  rpcUrls: [process.env.BASE_RPC!],
  privateKey: process.env.PK as Hex,
});

await mintPosition(ctx, {
  token0: "0x...",
  token1: "0x...",
  fee: 500,
  tickLower: -60_000,
  tickUpper: 60_000,
  amount0Desired: 1000000n,
  amount1Desired: 1000000000000000n,
  slippageBps: 50,
});
```

## Uso no navegador (walletClient injetado)

A lib roda no browser: nada em `src/` importa módulo do Node (garantido pelo fitness test
`tests/unit/browser-safety.test.ts`). Nesse modo a chave privada **nunca** entra na lib — quem
assina é a extensão do usuário, via um provider EIP-1193 descoberto por EIP-6963.

```typescript
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { createChainContext, sendTxRequest, signTypedData } from "@fsa-tools/web3";

// provider EIP-1193 vindo da extensão (descoberto por EIP-6963 no consumidor)
const [account] = await provider.request({ method: "eth_requestAccounts" });

const walletClient = createWalletClient({
  chain: base,
  transport: custom(provider),
  account,
});

const ctx = createChainContext({
  chainId: 8453,
  rpcUrls: [PUBLIC_BASE_RPC], // só o publicClient — nunca a assinatura
  walletClient,               // usado como está: transporte e conta são dele
});

await sendTxRequest(ctx, txRequest);        // eth_sendTransaction na extensão
await signTypedData(ctx, permitTypedData);  // eth_signTypedData_v4 (EIP-712)
```

Regras do modo injetado:

| Regra | Motivo |
|-------|--------|
| `privateKey` e `walletClient` são mutuamente exclusivos | `createChainContext` lança se receber os dois — ambiguidade sobre quem assina é risco de capital |
| `walletClient.chain.id` tem de bater com `chainId` | evita enviar tx na rede errada quando a extensão está em outra chain; `createChainContext` lança |
| `rpcUrls` continua obrigatório | alimenta o `publicClient` (leitura + `waitForTransactionReceipt`); nunca é usado para assinar |
| `publicClient` sempre vem do rpc-pool | independe da origem do `walletClient` |

`signTypedData(ctx, typedData)` funciona igual nos dois modos (chave local ou extensão) — é o seam
que o permit EIP-2612 consome.

### O que é server-only

Portável no sentido de "não importa Node", mas **destinado ao processo servidor**:

| Utilitário | Por quê |
|------------|---------|
| `withCooldown` / `rpc.cooldownMs` | o cooldown de 429 é estado por instância; no browser cada aba tem o seu e a proteção contra rate limit do provedor deixa de valer |
| `withConcurrencyLimit` / `rpc.maxConcurrency` | mesmo motivo: o semáforo só limita a concorrência do processo em que vive |
| `rpcUrls` com API key | qualquer URL passada ao `createChainContext` no browser é visível ao usuário — use endpoint público ou um proxy seu |

No browser, prefira `createChainContext` sem `rpc` (ou só com `timeoutMs`/`retryCount`) e um RPC
público. Os knobs de pool existem para os bots, que rodam em processo único e de longa duração.

## Migrating from v1.x to v2.0

In v1.x, each function received `publicClient`, `walletClient`, and `chainId` directly. In v2.0, create a `ChainContext` once and pass it to all functions.

### Before (v1.x)

```typescript
import { createClients } from "@fsa-tools/web3/utils";
import { mintPosition } from "@fsa-tools/web3/uniswap-v3";

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

### After (v2.0)

```typescript
import { createChainContext } from "@fsa-tools/web3/context";
import { mintPosition } from "@fsa-tools/web3/uniswap-v3";

const ctx = createChainContext({
  chainId: 8453,
  rpcUrls: [process.env.RPC_URL!],  // array required — fallback always active
  privateKey: process.env.PRIVATE_KEY as Hex,
});

await mintPosition(ctx, {
  token0: "0x...",
  token1: "0x...",
  fee: 500,
  // no publicClient, walletClient, chainId — they come from ctx
});
```

### Migration table

| v1.x | v2.0 |
|------|-------|
| `createClients(params)` from `@fsa-tools/web3/utils` | `createChainContext(params)` from `@fsa-tools/web3/context` |
| `rpcUrl: string` | `rpcUrls: string[]` (fallback always active) |
| `MintParams` | `MintOperationParams` |
| `SupplyParams` | `SupplyOperationParams` |
| `WithdrawParams` | `WithdrawOperationParams` |
| `DecreaseParams` | `DecreaseOperationParams` |
| `BurnParams` | `BurnOperationParams` |
| `CollectParams` | `CollectOperationParams` |
| `getTokenDecimals({ publicClient, token })` | `getTokenDecimals(ctx, { token })` |
| `ensureAllowance({ publicClient, walletClient, ... })` | `ensureAllowance(ctx, { token, spender, amount })` |
| `_resetCache()` (decimals singleton) | `ctx.decimalsCache = new Map()` (injectable DI) |
| `throw new Error("chainId X not supported")` | `throw new ChainNotSupportedError(chainId)` |

### Typed errors

```typescript
import {
  ChainNotSupportedError,
  ProtocolNotSupportedError,
  SlippageExceededError,
  ReceiptEventNotFoundError,
} from "@fsa-tools/web3/errors";

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

## Scripts

- `npm run build` — compila TypeScript
- `npm test` — unit tests
- `npm run test:smoke` — smoke tests contra testnet (requer `.env`)

## Recovery history

v1.7.1 é uma reconstrução completa do source tree a partir do `dist/` compilado de v1.7.0, após perda do repositório local durante um `mv` sem backup. Ver `docs/superpowers/specs/2026-04-18-fsa-web3-reconstruction-design.md`.

## Segurança

Ver `SECURITY.md` para known issues em v1.7.x.

### Approval mode (allowance exata vs. ilimitada)

`ensureAllowance` e as operações de protocolo (`MintOperationParams`, `SwapOperationParams` de uniswap-v3 e aerodrome) aceitam o parâmetro opcional `approvalMode`:

| Valor | Comportamento | Trade-off |
|-------|---------------|-----------|
| `"unlimited"` *(default)* | `approve(spender, MAX_UINT256)` | Allowance reaproveita entre operações → menos txs de approve, mais gas eficiente |
| `"exact"` | `approve(spender, amount)` | Nunca deixa allowance ilimitada no spender → mais seguro, mas custa um `approve` por operação |

O default `"unlimited"` é retrocompatível — código existente não precisa mudar.

> **Nota:** Aave não é afetado por esse parâmetro; já usa approve exato internamente via modelo plan.

**Exemplo — `ensureAllowance` direto:**

```typescript
import { ensureAllowance } from "@fsa-tools/web3/erc20";

await ensureAllowance(ctx, {
  token: "0x...",
  spender: "0x...",
  amount: 1_000_000n,
  approvalMode: "exact", // aprova só o amount necessário
});
```

**Exemplo — `mintPosition` (uniswap-v3) com allowance exata:**

```typescript
import { mintPosition } from "@fsa-tools/web3/uniswap-v3";

await mintPosition(ctx, {
  token0: "0x...",
  token1: "0x...",
  fee: 500,
  tickLower: -60_000,
  tickUpper: 60_000,
  amount0Desired: 1000000n,
  amount1Desired: 1000000000000000n,
  slippageBps: 50,
  approvalMode: "exact", // repassado internamente a ensureAllowance
});
```
