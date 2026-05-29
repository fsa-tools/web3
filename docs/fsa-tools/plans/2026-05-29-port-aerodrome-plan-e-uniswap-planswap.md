# Plan — Portar `plan*` do Aerodrome + `planSwapExactInputSingle` (uniswap-v3)

## Metadata

- **Generated:** 2026-05-29
- **Worktree:** required

## Context

- Projeto: `@fsa-tools/web3` (este repo — `fsa-web3` migrado de `@fsa/web3`/GitLab; baseline 3.1.2).
- Lib TypeScript ESM (`NodeNext`), viem v2, Vitest. Sem bundler.
- O path `plan*` (funções puras que constroem `TxRequest[]` sem signer/I/O) hoje cobre só `uniswap-v3` (LP) e `aave`. Faltam os `plan*` do Aerodrome e o `planSwapExactInputSingle` do uniswap-v3 — ambos já existem em versão execução-pura.
- Origem: issue `fabiosiqueira/defi-agent#34` (logada no tracker errado — o trabalho é todo aqui; `defi-project` só consome).

## Baseline (current state)

```bash
# Os planners ainda não existem nem são exportados:
grep -r "planSwapExactInputSingle" src/                      # → vazio
ls src/protocols/aerodrome/plan.ts                           # → No such file
grep "planMint" src/protocols/aerodrome/index.ts             # → vazio
```

## Objective

Espelhar o padrão `plan*` existente para: (1) os 4 planners de LP do Aerodrome (`planMint`, `planDecreaseLiquidity`, `planCollectFees`, `planBurnPosition`) e (2) `planSwapExactInputSingle` no uniswap-v3 — todos puros, retornando `TxRequest[]` com calldata idêntico ao da versão execução-pura.

## Definition of Done (global)

Single verifiable command:

```bash
npm run typecheck && npm test
```

**Expected output:** `tsc` sem erros e a suíte Vitest com todos os testes passando (incluindo `tests/unit/protocols/aerodrome/plan.test.ts` e `tests/unit/protocols/plan-uniswap-swap.test.ts`), exit 0.

> Bump semver e publish estão **fora de escopo** deste plano (rodar `/publish` em sessão separada).

## Policy (invariant)

- **Pureza:** todo `plan*` é síncrono, sem `ctx`/`ChainContext`, sem `await`, sem chamada de rede, sem signer. Recebe params explícitos e retorna `TxRequest[]`.
- **Calldata fiel:** usar a **mesma ABI** e a **mesma ordem/nomes de args** que a função de execução correspondente já usa. Não inventar campos nem reordenar.
- **Match de estilo exato:** copiar o estilo de `src/protocols/uniswap-v3/plan.ts` (helper `approveTx`, `value: 0n`, labels descritivos, `applySlippage` quando a execução aplica). Não refatorar nada existente.
- **Aerodrome ≠ Uniswap:** Aerodrome usa `AERODROME_NPM_ABI`, `tickSpacing` (não `fee`), `nftId` mapeado para o campo `tokenId` no calldata, e `sqrtPriceX96` no mint. NÃO copiar o calldata do uniswap; espelhar o source de execução do próprio Aerodrome.
- **Escopo de arquivos:** cada tarefa toca só os arquivos do seu protocolo (`aerodrome/*` ou `uniswap-v3/*`) + seu teste. Não tocar `tx/types.ts`, ABIs, math, nem o outro protocolo.
- **TDD:** escrever o teste de snapshot de calldata antes/junto da implementação, seguindo o padrão de `tests/unit/protocols/plan-uniswap-mint.test.ts` (decode via `decodeFunctionData` e assert de `to`/args).

## Dependency justification

- Nenhuma dependência declarada. Cluster 1 (`aerodrome/*`) e Cluster 2 (`uniswap-v3/*`) tocam conjuntos de arquivos disjuntos, cada um edita apenas o próprio `index.ts`, sem overlap e sem handoff de artefato. Rodam totalmente em paralelo.

## Clusters

### Cluster 1 — Aerodrome plan* (LP planners)

**Inter-cluster dependency:** none

#### Task 1.1: Criar `aerodrome/plan.ts` + exports + testes [sonnet] +reviewer

**Files:**
- Create: `src/protocols/aerodrome/plan.ts`
- Create: `tests/unit/protocols/aerodrome/plan.test.ts`
- Modify: `src/protocols/aerodrome/index.ts`

**Diagnosis:** Aerodrome tem `mintPosition`/`decreaseLiquidity`/`collectFees`/`burnPosition` (execução-pura) mas nenhum `plan*`. Replicar o padrão de `uniswap-v3/plan.ts`, porém com as especificidades do Aerodrome Slipstream confirmadas no source: ABI `AERODROME_NPM_ABI`, campo `tickSpacing`, `sqrtPriceX96` no mint, `nftId` da API mapeado para a key `tokenId` do calldata, e `recipient`/`deadline` (que a execução resolve via `walletClient`/default) viram params explícitos.

**Verification:** `npm run typecheck && npx vitest run tests/unit/protocols/aerodrome/plan.test.ts`

**Prompt for subagent (Agent tool):**
```
Projeto: /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3 (lib TS ESM, viem v2, Vitest).

TAREFA: criar os 4 planners puros de LP do Aerodrome, espelhando o padrão do uniswap-v3, e cobri-los com testes de snapshot de calldata.

CONTEXTO (leia estes arquivos antes de escrever):
- src/protocols/uniswap-v3/plan.ts          → padrão de estilo a copiar (helper approveTx, value:0n, labels, applySlippage no mint, formato dos Plan*Params com Omit/&).
- src/protocols/aerodrome/mint.ts            → ordem/nomes EXATOS dos args do mint do Aerodrome.
- src/protocols/aerodrome/decrease.ts        → args de decreaseLiquidity.
- src/protocols/aerodrome/collect.ts         → args de collect (recipient = walletClient.account.address na execução).
- src/protocols/aerodrome/burn.ts            → args de burn.
- src/protocols/aerodrome/types.ts           → *OperationParams a reusar (note: nftId, tickSpacing, npmAddress já está nos params base).
- src/abis/aerodrome-npm.ts                  → ABI canônica (use ESTA, não NPM_ABI do uniswap).
- src/tx/types.ts                            → TxRequest { label, to, data, value }.
- src/math/slippage.ts                       → applySlippage.
- tests/unit/protocols/plan-uniswap-mint.test.ts → padrão de teste a copiar (decodeFunctionData + assert de to/args).

IMPLEMENTAR em src/protocols/aerodrome/plan.ts (imports relativos com extensão .js):
1. planMint(params): TxRequest[]
   - PlanMintParams: reusar MintOperationParams do aerodrome + tornar recipient e deadline explícitos
     (siga o critério do uniswap PlanMintParams: campos que a execução obtém de ctx/default viram params).
     npmAddress já existe no MintOperationParams base — não duplicar.
   - amount0Min/amount1Min = applySlippage(amount*Desired, slippageBps) (igual à execução).
   - Retorna [approve token0→npmAddress (amount0Desired), approve token1→npmAddress (amount1Desired), mint].
   - mint via encodeFunctionData(AERODROME_NPM_ABI, "mint", [{ token0, token1, tickSpacing, tickLower,
     tickUpper, amount0Desired, amount1Desired, amount0Min, amount1Min, recipient, deadline, sqrtPriceX96 }]).
     Ordem/nomes IDÊNTICOS ao mint.ts.
2. planDecreaseLiquidity(params): TxRequest[]
   - PlanDecreaseParams: Omit slippage-irrelevante; tornar deadline, amount0Min, amount1Min explícitos
     (decrease.ts usa default 0n quando ausente; no plan são params obrigatórios, como no uniswap PlanDecreaseParams).
   - calldata: decreaseLiquidity [{ tokenId: nftId, liquidity, amount0Min, amount1Min, deadline }]. (nftId → key tokenId).
3. planCollectFees(params): TxRequest[]
   - PlanCollectParams: CollectOperationParams + recipient explícito (a execução usa walletClient.account.address).
   - calldata: collect [{ tokenId: nftId, recipient, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }].
     MAX_UINT128 = 2n ** 128n - 1n (mesma const do collect.ts/uniswap plan.ts).
4. planBurnPosition(params): TxRequest[]
   - PlanBurnParams: BurnOperationParams (npmAddress e nftId já presentes).
   - calldata: burn [nftId].

EXPORTS em src/protocols/aerodrome/index.ts (espelhar o bloco de export do uniswap-v3/index.ts):
- export { planMint, planDecreaseLiquidity, planCollectFees, planBurnPosition } from "./plan.js";
- export type { PlanMintParams, PlanDecreaseParams, PlanCollectParams, PlanBurnParams } from "./plan.js";

TESTES em tests/unit/protocols/aerodrome/plan.test.ts (Vitest, copiar estrutura de plan-uniswap-mint.test.ts):
- Para cada planner: assert do número de TxRequest, dos endereços `to`, de value===0n, e decode do calldata
  (decodeFunctionData com AERODROME_NPM_ABI / ERC20_ABI) verificando functionName e os args-chave
  (tickSpacing, tickLower/Upper, recipient, deadline, amount*Min com slippage no mint; tokenId no decrease/collect/burn).
- Use endereços/valores fixos como no teste de referência.

NÃO MODIFICAR: nenhum arquivo de execução do aerodrome, nenhuma ABI, tx/types.ts, math/, nem uniswap-v3/*.
NÃO refatorar código existente. Mudança mínima e cirúrgica. Imports ESM sempre com .js.

RETORNE: resumo do que foi criado, lista de arquivos tocados, e a saída de
`npm run typecheck && npx vitest run tests/unit/protocols/aerodrome/plan.test.ts`.
Return when `npm run typecheck && npx vitest run tests/unit/protocols/aerodrome/plan.test.ts` sai com exit 0.
```

### Cluster 2 — Uniswap-v3 planSwapExactInputSingle

**Inter-cluster dependency:** none

#### Task 2.1: Adicionar `planSwapExactInputSingle` + exports + testes [sonnet] +reviewer

**Files:**
- Modify: `src/protocols/uniswap-v3/plan.ts`
- Modify: `src/protocols/uniswap-v3/index.ts`
- Create: `tests/unit/protocols/plan-uniswap-swap.test.ts`

**Diagnosis:** `swapExactInputSingle` (execução) existe mas não há planner. A execução resolve via `ctx`/quote três coisas que o plan precisa explícitas: `routerAddress` (de `ctx.addresses.uniswapV3.swapRouter`), `recipient` (owner do wallet) e `amountOutMinimum` (derivado de quote on-chain + slippage). No plan, `amountOutMinimum` chega pronto (sem quote on-chain) — então `slippageBps` do `SwapOperationParams` deixa de ser usado e sai do tipo do planner.

**Verification:** `npm run typecheck && npx vitest run tests/unit/protocols/plan-uniswap-swap.test.ts`

**Prompt for subagent (Agent tool):**
```
Projeto: /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3 (lib TS ESM, viem v2, Vitest).

TAREFA: adicionar um planner puro do swap exactInputSingle ao uniswap-v3, espelhando swapExactInputSingle,
mas retornando TxRequest[] sem ctx/quote/rede. Cobrir com teste de snapshot de calldata.

CONTEXTO (leia antes de escrever):
- src/protocols/uniswap-v3/swap.ts     → função de execução a espelhar (args do exactInputSingle, sqrtPriceLimitX96 = 0n, ensureAllowance do tokenIn→swapRouter).
- src/protocols/uniswap-v3/plan.ts     → arquivo a estender; reusar o helper approveTx e o estilo (value:0n, labels). NÃO alterar os planners de LP existentes.
- src/protocols/uniswap-v3/types.ts    → SwapOperationParams { tokenIn, tokenOut, fee, amountIn, slippageBps, gasOptions }.
- src/abis/swap-router.ts              → SWAP_ROUTER_ABI (exactInputSingle, tuple: tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96). Use ESTA ABI.
- src/tx/types.ts                      → TxRequest.
- tests/unit/protocols/plan-uniswap-mint.test.ts → padrão de teste (decodeFunctionData + assert).

IMPLEMENTAR em src/protocols/uniswap-v3/plan.ts (adicionar ao final, sem mexer no que já existe):
- PlanSwapParams = Omit<SwapOperationParams, "slippageBps"> & {
    readonly routerAddress: Address;
    readonly recipient: Address;
    readonly amountOutMinimum: bigint;
  }
  (slippageBps sai porque amountOutMinimum já vem derivado fora — o plan não faz quote on-chain.)
- export function planSwapExactInputSingle(params: PlanSwapParams): TxRequest[]
  Retorna [approve(tokenIn → routerAddress, amountIn), swap].
  Reusar o helper approveTx já presente no arquivo (label no mesmo estilo dos demais).
  swap via encodeFunctionData(SWAP_ROUTER_ABI, "exactInputSingle", [{
    tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n
  }]). sqrtPriceLimitX96 = 0n (NO_PRICE_LIMIT, igual ao swap.ts). value: 0n.

EXPORTS em src/protocols/uniswap-v3/index.ts:
- adicionar planSwapExactInputSingle ao export { ... } from "./plan.js" existente.
- adicionar PlanSwapParams ao export type { ... } from "./plan.js" existente.

TESTES em tests/unit/protocols/plan-uniswap-swap.test.ts (Vitest):
- assert: 2 TxRequest; txs[0].to === tokenIn (approve), txs[1].to === routerAddress (swap); value===0n em ambos.
- decode approve (ERC20_ABI): functionName "approve", args [routerAddress, amountIn].
- decode swap (SWAP_ROUTER_ABI): functionName "exactInputSingle"; args[0] carrega tokenIn/tokenOut/fee/recipient/
  amountIn/amountOutMinimum corretos e sqrtPriceLimitX96 === 0n.
- valores/endereços fixos como no teste de referência.

NÃO MODIFICAR: swap.ts, quote.ts, types.ts, ABIs, tx/types.ts, aerodrome/*. NÃO alterar os planners de LP existentes em plan.ts.
Mudança mínima e cirúrgica. Imports ESM com .js.

RETORNE: resumo, arquivos tocados, e a saída de
`npm run typecheck && npx vitest run tests/unit/protocols/plan-uniswap-swap.test.ts`.
Return when `npm run typecheck && npx vitest run tests/unit/protocols/plan-uniswap-swap.test.ts` sai com exit 0.
```

## Launch order (DAG resolved)

### Phase 0 — parallel

- Cluster 1 / Task 1.1
- Cluster 2 / Task 2.1

**Fan-out Phase 0: 2 parallel tasks**
