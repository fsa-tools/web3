# @fsa/web3 — v2.0 API Redesign

**Data:** 2026-04-20
**Autor:** brainstorming (Claude + fabio)
**Status:** aprovado — pronto para writing-plans
**Ponto de partida:** v1.8.1 (feature/v1.8-completion)
**Target release:** v2.0.0 (breaking)

---

## Contexto

Roadmap v2.0 (`ROADMAP.md`) define 6 mudanças de API. Investigação nos 3 consumers (vfat-monitor, claw-yield, defigenius) confirma que todos inventaram o mesmo wrapper ad-hoc: guardam `publicClient`, `walletClient`, `chainId` numa classe e repassam em cada chamada de função da lib. A lib hoje obriga esse boilerplate — v2.0 formaliza `ChainContext` e elimina repetição.

Item 3 do roadmap (quebrar em packages separados) foi **descartado** após análise: racional era tree-shaking para bundle size, mas consumers são bots Node.js — benefício não se aplica. Itens 1, 2, 4, 5, 6 ficam.

## Objetivo

Publicar `@fsa/web3@2.0.0` com:
1. **ChainContext injetável** (item 1) — funções recebem `ctx` + params de operação, sem acesso global a `ADDRESSES`
2. **Erros tipados** (item 2) — classes substituem `throw new Error(string)`
3. **Tipos viem explícitos** (item 4) — `ExtractAbiFunction`/`ContractFunctionReturnType` elimina casts
4. **Multi-transport default** (item 5) — `rpcUrls: string[]` obrigatório, fallback ativo sempre
5. **Decimals cache como DI** (item 6) — `ctx.decimalsCache` opcional substitui singleton

## Não-objetivos

- Quebrar em packages separados (descartado)
- Adicionar protocolos ou chains
- Mudar módulos `abis/`, `constants/` (consumidos internamente apenas)
- Migrar os 3 consumers — cada um faz sua migração em task própria

---

## Arquitetura

### `ChainContext` — contrato central

```ts
// src/context.ts
export type ChainContext = {
  publicClient: PublicClient
  walletClient?: WalletClient<Transport, Chain, Account>
  addresses: ChainAddresses
  decimalsCache?: Map<string, number>
}

export function createChainContext(params: {
  chainId: number
  rpcUrls: string[]            // array obrigatório — item 5
  privateKey?: Hex
  decimalsCache?: Map<string, number>
}): ChainContext
```

`createChainContext` resolve `ADDRESSES[chainId]` internamente, lança `ChainNotSupportedError` se ausente. `fallback({ rank: true, retryCount: 1 })` é sempre aplicado ao transport.

### Assinatura padrão das funções de protocolo

```ts
// antes (v1.x)
mintPosition(params: MintParams): Promise<PositionResult>
// MintParams incluía { walletClient, publicClient, chainId, token0, ... }

// depois (v2.0)
mintPosition(ctx: ChainContext, params: MintOperationParams): Promise<PositionResult>
// MintOperationParams = apenas params de operação — { token0, token1, fee, tickLower, ... }
```

Aplica-se a **todas** as funções de protocolo (`aave`, `aerodrome`, `uniswap-v3`) e utils que hoje recebem clients (`getTokenDecimals`, `ensureAllowance`, `getBalance`, `withGasGuard`, `getEthPriceUsd`, `resolvePoolAddress`, etc.).

### Erros tipados

```ts
// src/errors.ts
export class ChainNotSupportedError extends Error {
  constructor(public readonly chainId: number)
}
export class ProtocolNotSupportedError extends Error {
  constructor(public readonly chainId: number, public readonly protocol: string)
}
export class ReserveInactiveError extends Error {
  constructor(public readonly asset: Address, public readonly reason?: string)
}
export class InsufficientAllowanceError extends Error {
  constructor(public readonly token: Address, public readonly required: bigint, public readonly actual: bigint)
}
export class SlippageExceededError extends Error {
  constructor(public readonly bps: number, public readonly max: number)
}
export class AddressValidationError extends Error {
  constructor(public readonly value: string)
}
export class ReceiptEventNotFoundError extends Error {
  constructor(public readonly eventName: string, public readonly txHash: Hex)
}
```

Substituem todos os `throw new Error(string)` da codebase. Consumers matcheam com `instanceof` em vez de regex na mensagem.

### Tipagem viem

Casts residuais (`as number`, `as bigint[]`, `as any`) em `readContract` substituídos por inferência via `ContractFunctionReturnType<typeof ABI, 'pure' | 'view', 'functionName'>`. Mudança interna — zero impacto de API pública.

---

## Estrutura de arquivos

### Novos

```
src/
├── context.ts      # createChainContext + ChainContext type
└── errors.ts       # classes de erro tipadas
```

### Modificados (assinaturas)

```
src/protocols/
  aave/        supply.ts, withdraw.ts, position.ts, types.ts
  aerodrome/   mint.ts, burn.ts, decrease.ts, collect.ts, types.ts
  uniswap-v3/  mint.ts, burn.ts, decrease.ts, collect.ts, types.ts
src/utils/
  decimals.ts, erc20.ts, gas.ts, pool.ts, position.ts
```

### Tipos renomeados

```
MintParams            → MintOperationParams
SupplyParams          → SupplyOperationParams
WithdrawParams        → WithdrawOperationParams
DecreaseParams        → DecreaseOperationParams
BurnParams            → BurnOperationParams
CollectParams         → CollectOperationParams
```

Sem aliases deprecados — v2.0 é breaking; consumers migram de vez.

### `package.json`

- `version: "2.0.0"`
- Novos exports: `./errors`, `./context`
- Exports existentes (`/uniswap-v3`, `/aave`, `/aerodrome`, `/utils`, `/math`, `/abis`, `/constants`) mantidos
- `createClients` removido de `/utils` — substituído por `createChainContext`
- `ADDRESSES` continua exportado em `/constants` mas marcado `@internal` via JSDoc (uso direto desencorajado)

---

## Decimals cache

Hoje: `src/utils/decimals.ts` tem `Map<string,number>` em module scope, compartilhado globalmente. Em v2.0:

```ts
export async function getTokenDecimals(
  ctx: ChainContext,
  params: { token: Address }
): Promise<number>
```

- Se `ctx.decimalsCache` existe → usa injetado
- Se ausente → faz read on-chain a cada chamada (sem cache implícito)
- Consumer que quer reuso cria `const cache = new Map()` e injeta no ctx

Module-level singleton removido. Elimina estado global escondido, facilita testes.

---

## Testes

### Unit

Novos:
- `tests/unit/context.test.ts` — `createChainContext` com chainId suportado/não-suportado, rpcUrls válido, PK opcional
- `tests/unit/errors.test.ts` — cada classe carrega campos estruturados, `instanceof Error` funciona

Migrados:
- `math/`, `utils/address`, `utils/decimals` — imports atualizados, lógica pura inalterada

Type-level (novo):
- `tests/types/viem-inference.test-d.ts` — `expectTypeOf` valida retorno de `readContract` sem cast

### Smoke

Todos os `tests/smoke/*.test.ts` migram para `createChainContext` + nova assinatura. Gates e cleanup inalterados.

Novo smoke:
- `tests/smoke/context.smoke.test.ts` — valida fallback RPC real (2 URLs, primeira inválida, segunda responde)

---

## Versionamento & Release

- Branch: `feature/v2.0`
- Commits granulares por etapa (errors, context, protocol aave, protocol aerodrome, ...)
- `v2.0.0-rc.1` publicado primeiro → testado em 1 consumer
- `v2.0.0` estável após RC OK
- CHANGELOG `[2.0.0]` com tabela antes/depois por função + seção "Migration guide"
- README ganha seção "Migrating from v1.x to v2.0" com exemplos de diff

---

## Riscos

Maioria coberta por TypeScript (assinaturas mudadas quebram compile nos consumers) e erros tipados lançados no boundary. Risco residual único:

| Risco | Mitigação |
|---|---|
| Consumer quebra em runtime não pego por typecheck | RC testado em 1 consumer antes de promover estável |

---

## Sequenciamento (alto nível — detalhado em writing-plans)

1. Bootstrap: branch `feature/v2.0`, bump version, CHANGELOG stub
2. `src/errors.ts` — classes novas, sem mudar código que ainda usa string
3. `src/context.ts` — `ChainContext` + `createChainContext`
4. Refactor `getTokenDecimals` para usar `ctx.decimalsCache`
5. Migrar protocolos: `aave` → `aerodrome` → `uniswap-v3` (cada um é um commit)
6. Migrar utils restantes (`erc20`, `gas`, `pool`, `position`)
7. Substituir `throw new Error(...)` por classes tipadas em toda codebase
8. Tipar `readContract` com `ContractFunctionReturnType` — eliminar casts
9. Unit tests novos (`context`, `errors`) + type-level tests + migrar existentes
10. Smoke tests migrados + novo smoke de fallback RPC
11. README "Migrating from v1.x to v2.0" + CHANGELOG `[2.0.0]` completo
12. PAUSA — usuário roda smoke nas 3 chains
13. Publish `v2.0.0-rc.1` → teste em 1 consumer
14. Publish `v2.0.0` estável

---

## Entregáveis

1. `src/context.ts` e `src/errors.ts` novos
2. Todos protocolos e utils migrados para `(ctx, params)`
3. Exports `./errors` e `./context` no `package.json`
4. Unit + type-level + smoke tests passando
5. README com guia de migração v1.x → v2.0
6. CHANGELOG `[2.0.0]` completo
7. `v2.0.0` publicado no Verdaccio (após RC validado em 1 consumer)
