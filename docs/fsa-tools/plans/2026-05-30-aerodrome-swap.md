# Plan — Aerodrome Slipstream swap (planner + execução + quote)

## Metadata

- **Generated:** 2026-05-30
- **Worktree:** required
- **Issue:** `fsa-tools/web3#1` — consumidor `fabiosiqueira/defi-agent#43`

## Context

- Projeto: `@fsa-tools/web3` (lib TS ESM `NodeNext`, viem v2, Vitest, sem bundler; baseline 3.2.0).
- Hoje o Aerodrome só expõe LP (`mint/decrease/collect/burn` + os `plan*` do commit `cd99698`). **Não há swap de execução nem ABI de router Aerodrome** — o único `SWAP_ROUTER_ABI` é do Uniswap V3.
- O consumidor `defi-agent#43` faz *balancing swap* na entrada de LP em pools **`aerodrome-slipstream`** (CL concentrado). Hoje só o path uniswapV3 rebalanceia; o path Aerodrome entra sem swap.
- Decisão de design (a issue levanta CL `exactInputSingle` vs rota Velodrome `stable/volatile`): como o consumidor opera pools Slipstream, o primitivo correto é o **SwapRouter do Slipstream com `exactInputSingle`** — **não** o `Router.sol` v2 (stable/volatile com `routes[]`).

## Objective

Paridade total com `uniswap-v3` para swap single-hop no Aerodrome Slipstream: ABIs (router + quoter), tipos, `quoteExactInputSingle` (execução com ctx), `swapExactInputSingle` (execução com ctx), `planSwapExactInputSingle` (puro, `TxRequest[]`), endereços em Base, exports e testes.

## Verified facts (web research, 2026-05-30)

Fonte: `github.com/aerodrome-finance/slipstream` (`contracts/periphery/interfaces/`), endereços via BaseScan.

**SwapRouter** (Base 8453): `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`
```solidity
// ISwapRouter.ExactInputSingleParams — exactInputSingle é payable
struct ExactInputSingleParams {
  address tokenIn;
  address tokenOut;
  int24   tickSpacing;     // ← no lugar de `fee` (uint24) do Uniswap
  address recipient;
  uint256 deadline;        // ← Slipstream TEM deadline (≠ Uniswap SwapRouter02)
  uint256 amountIn;
  uint256 amountOutMinimum;
  uint160 sqrtPriceLimitX96;
}
// returns (uint256 amountOut)
```

**Quoter** (Base 8453): `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0`
```solidity
// IQuoterV2.QuoteExactInputSingleParams — nonpayable on-chain, chamado read-only via eth_call
struct QuoteExactInputSingleParams {
  address tokenIn;
  address tokenOut;
  uint256 amountIn;
  int24   tickSpacing;     // ← no lugar de `fee`
  uint160 sqrtPriceLimitX96;
}
// returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)
```

> ⚠️ Os dois endereços acima são da exibição do BaseScan; o subagente deve normalizar via `getAddress()` da viem (ou usar a forma checksummed) para casar o estilo de `addresses.ts`.

## Definition of Done (global)

Single verifiable command:

```bash
npm run typecheck && npm test
```

**Expected output:** `tsc --project tsconfig.test.json` sem erros e a suíte Vitest (`vitest run`) com todos os testes passando — incluindo os novos `tests/unit/protocols/aerodrome/swap.test.ts`, `tests/unit/protocols/aerodrome/quote.test.ts` e o bloco de swap em `tests/unit/protocols/aerodrome/plan.test.ts` — exit 0.

> Bump semver e publish estão **fora de escopo** (rodar `/publish` em sessão separada). Smoke tests (`test:smoke`) não são tocados — são config separada e gated por `baseSepolia`.

## Policy (invariant)

- **Calldata fiel:** usar a ABI do Slipstream confirmada acima (`tickSpacing` int24, `deadline` no router). NÃO copiar a tuple do Uniswap (que usa `fee` e não tem `deadline`).
- **Match de estilo exato:** espelhar `uniswap-v3/swap.ts`, `uniswap-v3/quote.ts` e o bloco `planSwapExactInputSingle` de `uniswap-v3/plan.ts` (helper `approveTx`, `value:0n`, `NO_PRICE_LIMIT`/`sqrtPriceLimitX96:0n`, `applySlippage`, `ensureAllowance`, erro `ProtocolNotSupportedError`, leitura de `ctx.addresses.aerodrome?.{swapRouter,quoter}`). Não refatorar nada existente.
- **Pureza do plan:** `planSwapExactInputSingle` é síncrono, sem `ctx`, sem `await`, sem rede. `amountOutMinimum` e `deadline` chegam prontos do caller (sem quote on-chain), então `slippageBps` sai do tipo do planner — exatamente como no uniswap.
- **Deadline na execução:** `swapExactInputSingle` (com ctx) resolve `deadline = params.deadline ?? now + DEFAULT_DEADLINE_SECONDS`, igual ao padrão de `aerodrome/mint.ts` (`DEFAULT_DEADLINE_SECONDS = 1200n`).
- **Escopo de arquivos:** tocar apenas `abis/aerodrome-swap-router.ts`, `abis/aerodrome-quoter.ts`, `abis/index.ts`, `protocols/aerodrome/{swap,quote,plan,types,index}.ts`, `constants/addresses.ts` e os testes do aerodrome. NÃO tocar uniswap-v3/*, aave/*, tx/types.ts, math/, nem os planners de LP existentes em `aerodrome/plan.ts`.
- **TDD:** escrever os testes de snapshot de calldata (plan) e os testes de execução com ctx mockado (swap/quote) junto/antes da implementação, seguindo os padrões de referência citados.

## Dependency justification

- Task única (1.1). Nenhuma dependência inter-task a justificar. Todos os arquivos são coesos e compartilham `aerodrome/types.ts` + `aerodrome/index.ts`; dividir em subtasks paralelas colidiria nesses dois arquivos sem ganho de wall-clock real — por isso um único agente coeso.

## Clusters

### Cluster 1 — Aerodrome Slipstream swap path

**Inter-cluster dependency:** none

#### Task 1.1: ABIs + types + quote + swap + plan + addresses + exports + testes [sonnet] +reviewer

**Files:**
- Create: `src/abis/aerodrome-swap-router.ts`
- Create: `src/abis/aerodrome-quoter.ts`
- Create: `src/protocols/aerodrome/swap.ts`
- Create: `src/protocols/aerodrome/quote.ts`
- Create: `tests/unit/protocols/aerodrome/swap.test.ts`
- Create: `tests/unit/protocols/aerodrome/quote.test.ts`
- Modify: `src/abis/index.ts`
- Modify: `src/protocols/aerodrome/types.ts`
- Modify: `src/protocols/aerodrome/plan.ts`
- Modify: `src/protocols/aerodrome/index.ts`
- Modify: `src/constants/addresses.ts`
- Modify: `tests/unit/protocols/aerodrome/plan.test.ts`

**Diagnosis:** o Aerodrome tem LP completo mas zero swap. Espelhar o trio uniswap-v3 (`swap.ts`/`quote.ts`/`plan.ts::planSwapExactInputSingle`) usando a ABI do Slipstream (router com `tickSpacing`+`deadline`, quoter com `tickSpacing`). Os tipos de swap/quote ainda não existem em `aerodrome/types.ts` (lá só há os de LP). `ProtocolAddresses` já tem `swapRouter?`/`quoter?` opcionais — basta preencher em 8453.

**Verification:** `npm run typecheck && npx vitest run tests/unit/protocols/aerodrome/`

**Prompt for subagent (Agent tool):**
```
Projeto: /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3 (lib TS ESM NodeNext, viem v2, Vitest, sem bundler).

TAREFA: dar ao Aerodrome paridade de SWAP com o uniswap-v3 — ABIs do Slipstream (router+quoter), tipos, quote/swap de execução (com ctx) e planSwapExactInputSingle puro, mais endereços em Base, exports e testes. Mudança cirúrgica, sem refatorar nada existente.

DECISÃO DE DESIGN JÁ TOMADA: usar o SwapRouter do Aerodrome Slipstream (CL concentrado, exactInputSingle), NÃO o Router v2 stable/volatile com routes[].

CONTEXTO (leia ANTES de escrever):
- src/protocols/uniswap-v3/swap.ts       → padrão da execução (ensureAllowance tokenIn→router, quote→applySlippage→amountOutMinimum, getBalance antes/depois p/ amountOut por delta, writeContract, waitForTransactionReceipt confirmations:2, ProtocolNotSupportedError quando falta router).
- src/protocols/uniswap-v3/quote.ts      → padrão do quote (readContract no quoter, NO_PRICE_LIMIT=0n, validateAddress, ProtocolNotSupportedError quando falta quoter).
- src/protocols/uniswap-v3/plan.ts       → bloco planSwapExactInputSingle + helper approveTx + PlanSwapParams (Omit<SwapOperationParams,"slippageBps"> & {routerAddress,recipient,amountOutMinimum}).
- src/protocols/uniswap-v3/types.ts      → SwapOperationParams/SwapResult/QuoteOperationParams/QuoteResult (modelo dos tipos).
- src/protocols/aerodrome/mint.ts        → padrão de execução do Aerodrome E o tratamento de deadline (DEFAULT_DEADLINE_SECONDS = 1200n; deadline = params.deadline ?? BigInt(Math.floor(Date.now()/1000)) + DEFAULT_DEADLINE_SECONDS).
- src/protocols/aerodrome/plan.ts        → arquivo a ESTENDER; reusar o approveTx já presente, NÃO mexer nos planners de LP.
- src/protocols/aerodrome/types.ts       → arquivo a ESTENDER com os tipos de swap/quote.
- src/abis/swap-router.ts e src/abis/quoter.ts → formato das ABIs `as const` (note o truque stateMutability:"view" no quoter p/ usar readContract sem assertion).
- src/abis/index.ts                      → onde re-exportar as novas ABIs.
- src/constants/addresses.ts             → ADDRESSES[8453].aerodrome (hoje só { npm }); ProtocolAddresses já tem swapRouter?/quoter?.
- src/tx/types.ts                        → TxRequest { label, to, data, value }.
- src/math/slippage.ts                   → applySlippage.
- tests/unit/protocols/swap.test.ts          → padrão do teste de execução com ctx mockado (vi.fn em readContract/writeContract/waitForTransactionReceipt; assert de ordem approve→swap, amountOutMinimum, falha sem router).
- tests/unit/protocols/quote.test.ts         → padrão do teste de quote com ctx mockado.
- tests/unit/protocols/aerodrome/plan.test.ts → arquivo a ESTENDER com o bloco de swap (decodeFunctionData + assert).

FATOS VERIFICADOS (ABI do Slipstream — github.com/aerodrome-finance/slipstream; endereços via BaseScan):
- SwapRouter (Base 8453): 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
  exactInputSingle (payable), tuple `params` na ORDEM:
    tokenIn(address), tokenOut(address), tickSpacing(int24), recipient(address),
    deadline(uint256), amountIn(uint256), amountOutMinimum(uint256), sqrtPriceLimitX96(uint160)
  returns (amountOut uint256)
- Quoter (Base 8453): 0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0
  quoteExactInputSingle, tuple `params` na ORDEM:
    tokenIn(address), tokenOut(address), amountIn(uint256), tickSpacing(int24), sqrtPriceLimitX96(uint160)
  returns (amountOut uint256, sqrtPriceX96After uint160, initializedTicksCrossed uint32, gasEstimate uint256)
  → marque stateMutability:"view" na ABI (mesmo truque do QUOTER_V2_ABI do uniswap).
  Normalize os dois endereços com getAddress() da viem antes de gravar em addresses.ts (casar checksum do arquivo).

IMPLEMENTAR:

1) src/abis/aerodrome-swap-router.ts — export const AERODROME_SWAP_ROUTER_ABI = [...] as const com exactInputSingle (stateMutability:"payable") e a tuple/ordem acima.
2) src/abis/aerodrome-quoter.ts — export const AERODROME_QUOTER_ABI = [...] as const com quoteExactInputSingle (stateMutability:"view") e a tuple/outputs acima. Inclua o comentário explicando o "view" (igual ao quoter.ts do uniswap).
3) src/abis/index.ts — re-exportar AERODROME_SWAP_ROUTER_ABI e AERODROME_QUOTER_ABI.
4) src/protocols/aerodrome/types.ts — ADICIONAR (espelhar uniswap, trocando fee→tickSpacing):
   - SwapOperationParams = { tokenIn, tokenOut, tickSpacing:number, amountIn:bigint, slippageBps:number, deadline?:bigint, gasOptions?:GasOptions }
   - SwapResult = { amountOut:bigint, txHash:Hash, gasUsed:bigint }
   - QuoteOperationParams = { tokenIn, tokenOut, tickSpacing:number, amountIn:bigint }
   - QuoteResult = { amountOut:bigint, sqrtPriceX96After:bigint, initializedTicksCrossed:number, gasEstimate:bigint }
   (importar GasOptions já existe no topo do arquivo.)
5) src/protocols/aerodrome/quote.ts — quoteExactInputSingle(ctx, params): Promise<QuoteResult>, espelhando uniswap/quote.ts:
   - quoter = ctx.addresses.aerodrome?.quoter; se ausente → throw new ProtocolNotSupportedError(ctx.publicClient.chain?.id ?? 0, "aerodrome.quoter").
   - validateAddress em tokenIn/tokenOut. readContract(AERODROME_QUOTER_ABI, "quoteExactInputSingle", [{tokenIn,tokenOut,amountIn,tickSpacing,sqrtPriceLimitX96:0n}]). Destructure dos 4 outputs e retornar QuoteResult.
6) src/protocols/aerodrome/swap.ts — swapExactInputSingle(ctx, params): Promise<SwapResult>, espelhando uniswap/swap.ts MAS com as especificidades do Aerodrome:
   - guard walletClient; guard slippage (MAX_SLIPPAGE_BPS=5_000, SlippageExceededError).
   - swapRouter = ctx.addresses.aerodrome?.swapRouter; ausente → ProtocolNotSupportedError(..., "aerodrome").
   - ensureAllowance(tokenIn→swapRouter, amountIn).
   - deadline = params.deadline ?? BigInt(Math.floor(Date.now()/1000)) + DEFAULT_DEADLINE_SECONDS (1200n).
   - amountOutMinimum = applySlippage(quoteExactInputSingle(...).amountOut, slippageBps) (importar do ./quote.js local).
   - getBalance(tokenOut, owner) antes; writeContract(AERODROME_SWAP_ROUTER_ABI,"exactInputSingle",[{tokenIn,tokenOut,tickSpacing,recipient:owner,deadline,amountIn,amountOutMinimum,sqrtPriceLimitX96:0n}], ...gasOptions); waitForTransactionReceipt confirmations:2; getBalance depois; retornar {amountOut: after-before, txHash, gasUsed}.
7) src/protocols/aerodrome/plan.ts — ADICIONAR ao final (sem tocar nos planners de LP):
   - import { AERODROME_SWAP_ROUTER_ABI } e import type { SwapOperationParams } from "./types.js".
   - PlanSwapParams = Omit<SwapOperationParams,"slippageBps"|"deadline"|"gasOptions"> & { readonly routerAddress:Address; readonly recipient:Address; readonly amountOutMinimum:bigint; readonly deadline:bigint }.
   - planSwapExactInputSingle(params): TxRequest[] → [ approveTx(tokenIn→routerAddress, amountIn, "approve tokenIn (...) → Aerodrome SwapRouter"), swap ]
     swap.to=routerAddress, value:0n, encodeFunctionData(AERODROME_SWAP_ROUTER_ABI,"exactInputSingle",[{tokenIn,tokenOut,tickSpacing,recipient,deadline,amountIn,amountOutMinimum,sqrtPriceLimitX96:0n}]).
     label estilo "swap exactInputSingle ${tokenIn} → ${tokenOut} via Aerodrome Slipstream".
8) src/protocols/aerodrome/index.ts — adicionar:
   - export { swapExactInputSingle } from "./swap.js"; export { quoteExactInputSingle } from "./quote.js";
   - export { planSwapExactInputSingle } from "./plan.js"; export type { PlanSwapParams } from "./plan.js";
   - export type { SwapOperationParams, SwapResult, QuoteOperationParams, QuoteResult } from "./types.js";
9) src/constants/addresses.ts — em ADDRESSES[8453].aerodrome, adicionar swapRouter e quoter (checksummed via getAddress dos endereços acima). NÃO mexer em outras chains.

TESTES:
- tests/unit/protocols/aerodrome/quote.test.ts — mock ctx (publicClient.readContract via vi.fn devolvendo [amountOut, sqrtPriceX96After, ticks, gas]); assert que quoteExactInputSingle chama com tickSpacing e retorna QuoteResult; assert que falha sem ctx.addresses.aerodrome.quoter. Espelhar tests/unit/protocols/quote.test.ts.
- tests/unit/protocols/aerodrome/swap.test.ts — mock ctx (readContract: allowance=0n, quoteExactInputSingle=[QUOTED_OUT,...], balanceOf antes=0/depois=N; walletClient.writeContract captura calls). Asserts: ordem approve antes de exactInputSingle; amountOutMinimum = applySlippage(QUOTED_OUT, bps); args do exactInputSingle carregam tickSpacing e deadline; result.amountOut = delta de saldo; falha sem swapRouter. Espelhar tests/unit/protocols/swap.test.ts.
- tests/unit/protocols/aerodrome/plan.test.ts — ADICIONAR describe("planSwapExactInputSingle (aerodrome)"): importar planSwapExactInputSingle e AERODROME_SWAP_ROUTER_ABI. Asserts: 2 TxRequest; txs[0].to===tokenIn (approve, decode ERC20_ABI → args [routerAddress, amountIn]); txs[1].to===routerAddress; value===0n em ambos; decode exactInputSingle → args[0] carrega tokenIn/tokenOut/tickSpacing/recipient/deadline/amountIn/amountOutMinimum corretos e sqrtPriceLimitX96===0n. Valores/endereços fixos.

REGRAS:
- Imports relativos SEMPRE com extensão .js (NodeNext). `import type` para tipos.
- Sem `any`; sem mutação de inputs; funções ≤50 linhas.
- NÃO MODIFICAR: uniswap-v3/*, aave/*, tx/types.ts, math/*, os planners de LP do aerodrome, nem as ABIs existentes.
- Mudança mínima e cirúrgica; copie o estilo dos arquivos de referência sem desvio.

RETORNE: resumo do que foi criado/modificado, lista de arquivos tocados, e a saída de
`npm run typecheck && npx vitest run tests/unit/protocols/aerodrome/`.
Return quando `npm run typecheck && npx vitest run tests/unit/protocols/aerodrome/` sair com exit 0.
```

## Launch order (DAG resolved)

### Phase 0 — single task

- Cluster 1 / Task 1.1

**Fan-out Phase 0: 1 task**

## Post-execution

- `/fsa-tools:review` roda automático (task tagged `+reviewer`): compliance de spec → qualidade de código.
- DoD final: `npm run typecheck && npm test` exit 0.
- Fora de escopo (sessões separadas): `/publish` (bump semver 3.2.0 → 3.3.0 minor + publish), generalização do lado `defi-agent#43`.
