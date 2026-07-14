# Plan — RPC 429 hardening + Aerodrome slippageBps

## Metadata

- **Generated:** 2026-07-07
- **Worktree:** required
- **Issues:** fsa-tools/web3#5 (A1), fsa-tools/web3#4 (A2)

## Context

- Root: `/Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3` — lib `@fsa-tools/web3` (TypeScript, ESM/NodeNext, viem, vitest).
- Duas melhorias `enhancement` independentes: robustez da detecção de 429 no pool RPC (#5) e paridade de `slippageBps` no `decreaseLiquidity` do Aerodrome com o Uniswap v3 (#4).
- Arquivos-alvo disjuntos → sem dependência entre as tasks.

## Baseline (current state)

```bash
# is429 detecta 429 apenas por `.status === 429` na cause-chain (depth 5), com magic numbers embutidos:
sed -n '37,49p' src/utils/rpc-pool.ts
# Aerodrome decreaseLiquidity só aceita mins absolutos; ausentes caem em 0n (zero proteção de slippage):
sed -n '20,40p' src/protocols/aerodrome/decrease.ts
grep -n 'slippageBps' src/protocols/aerodrome/types.ts   # → sem match
```

## Objective

(A1) Endurecer `is429` em `withCooldown` para reconhecer 429 em múltiplas shapes, com constantes nomeadas, sem alterar a API pública. (A2) Adicionar `slippageBps?: number` ao `decreaseLiquidity` do Aerodrome, computando os mins internamente por simulação (paridade com Uniswap v3), mantendo mins explícitos como override.

## Definition of Done (global)

```bash
npm run build && npm test
```

**Expected output:** `tsc` sem erros e vitest reportando todos os arquivos de teste passando (incluindo os novos casos por shape de 429 em `rpc-pool.test.ts` e a derivação de mins do Aerodrome decrease).

## Policy (invariant)

- **Mudança cirúrgica e mínima.** Toque apenas os arquivos listados na task. Zero refactor, rename ou reorganização de imports fora do escopo.
- **Match do estilo existente exatamente.** Antes de editar, releia o arquivo-alvo e o vizinho de referência citado; copie naming, error handling, estrutura de teste (vitest `describe`/`it`, `vi.fn()`, `mkTransport`/`mockCtx`).
- **Sem API pública quebrada.** Assinaturas exportadas existentes permanecem retrocompatíveis. Novos campos são opcionais (`?:`).
- **Sem magic numbers novos.** Números em lógica viram constantes nomeadas (regra do projeto).
- **Não rode nem edite smoke tests** (`tests/smoke/*`, env-gated). A verificação é unit + build.

## Dependency justification

- Nenhuma dependência declarada. A1 e A2 não compartilham arquivos, tipos ou símbolos exportados. `rpc-pool.ts` (util de transport) e `protocols/aerodrome/*` (protocolo) são módulos disjuntos; ambas rodam em paralelo desde t0.

## Clusters

### Cluster 1 — Melhorias independentes

**Inter-cluster dependency:** none

#### Task 1.1: Endurecer detecção de 429 em `is429` [sonnet]

**Files:**
- Modify: `src/utils/rpc-pool.ts`
- Modify: `tests/unit/utils/rpc-pool.test.ts`

**Diagnosis:** `is429` (linhas 37–49) detecta 429 só por `(cur).status === 429` na cause-chain com `depth 5` e literal `429` embutidos. Um provider que exponha rate-limit noutra shape (`.statusCode`, ou só em `message`/`statusText`) não dispara o cooldown → o provider 429'd continua sendo martelado. Endurecer a classificação sem tocar a API pública de `withCooldown`.

**Verification:** `npm run build && npx vitest run tests/unit/utils/rpc-pool.test.ts`

**Prompt for subagent (Agent tool):**
```
Projeto: /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3 (lib @fsa-tools/web3, TypeScript ESM/NodeNext, viem, vitest).

Tarefa: endurecer a função `is429` em `src/utils/rpc-pool.ts` para reconhecer respostas HTTP 429 (rate-limit) em mais de uma shape, sem alterar a API pública de `withCooldown`/`withConcurrencyLimit`/`createSemaphore`. Follow-up da issue #5.

Contexto — estado atual (src/utils/rpc-pool.ts, linhas 37-49):
```ts
function is429(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    if (
      typeof cur === "object" &&
      cur !== null &&
      (cur as { status?: number }).status === 429
    )
      return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
```
`is429` é consumida só por `withCooldown` (linha 64: `if (is429(err)) cooldownUntil = Date.now() + cooldownMs;`).

Requisitos:
1. Extraia dois magic numbers para constantes nomeadas no topo do módulo (ou junto da função): a profundidade da cause-chain (hoje `5`) e o código HTTP 429. Sugestão de nomes: `CAUSE_CHAIN_MAX_DEPTH = 5` e `HTTP_TOO_MANY_REQUESTS = 429`. Se houver outras strings de sinal, use constantes também.
2. `is429` deve reconhecer 429 percorrendo a mesma cause-chain (até CAUSE_CHAIN_MAX_DEPTH níveis via `.cause`), retornando true quando QUALQUER nível casar uma destas shapes:
   - propriedade numérica `.status === 429`
   - propriedade numérica `.statusCode === 429`
   - `.message` (string) OU `.statusText` (string) contendo, case-insensitive, um dos sinais de rate-limit: o número `429`, "too many requests" ou "rate limit".
3. Retrocompat rígida: toda shape hoje reconhecida (`.status === 429`, inclusive via cause-chain) continua disparando true. ZERO falso-positivo: um erro genérico não-429 (ex.: `new Error("boom")`, ou `.status === 500`, ou message "gateway timeout") deve retornar false. Cuidado ao casar substring "429" na message — só casar quando for sinal real de rate-limit; não casar, por exemplo, um hash ou id que contenha "429" fora de contexto NÃO é requisito — mantenha simples: casar "429" como token na message é aceitável, mas priorize os sinais textuais ("too many requests"/"rate limit") e as props numéricas. Se optar por casar o número na message, garanta que os testes de não-429 existentes continuem passando.
4. Type-safety: nada de `any`. Use `unknown` + type guards (siga o estilo já presente: `typeof cur === "object" && cur !== null && (cur as {...}).x`). Sem `@ts-ignore`.
5. NÃO altere `createSemaphore`, `withCooldown` (exceto se precisar, mas o corpo dele não deve mudar — só `is429`), nem `withConcurrencyLimit`. NÃO mude assinaturas exportadas.

Testes (tests/unit/utils/rpc-pool.test.ts): o arquivo já tem um bloco `describe("withCooldown", ...)` com casos usando `mkTransport`, `vi.fn()`, `vi.useFakeTimers()`. Siga EXATAMENTE esse padrão (helpers `mkTransport`/`deferred` já existem no topo do arquivo — reutilize, não recrie). Adicione casos cobrindo cada shape nova reconhecida, cada um verificando que o cooldown É ativado (2ª chamada lança "provider in cooldown" e `inner` só foi chamado 1x), espelhando o teste existente "activates cooldown on 429":
- erro cru com `.statusCode === 429`
- erro cujo 429 está só na `.message` (ex.: "HTTP 429 Too Many Requests")
- erro cujo 429 está só no `.statusText` (ex.: `Object.assign(new Error("req failed"), { statusText: "Too Many Requests" })`)
- 429 numa dessas shapes via cause-chain (aninhado em `.cause`)
E pelo menos um caso NEGATIVO garantindo retrocompat do não-429: erro com `.status === 500` OU message "gateway timeout" NÃO ativa cooldown (2ª chamada alcança `inner`). Os casos existentes (`.status === 429` direto e via cause) devem continuar passando sem edição.

Restrições:
- Mudança cirúrgica: só `src/utils/rpc-pool.ts` e `tests/unit/utils/rpc-pool.test.ts`.
- Sem console.log, sem código comentado, sem TODO.

Verificação (rode antes de retornar): `npm run build && npx vitest run tests/unit/utils/rpc-pool.test.ts` → tsc sem erros, todos os testes do arquivo passando.

Retorne quando: build limpo e o arquivo de teste passa 100%, com os novos casos por shape verdes. No retorno, liste as shapes agora reconhecidas e os nomes das constantes extraídas.
```

#### Task 1.2: `slippageBps` no `decreaseLiquidity` do Aerodrome [sonnet] +reviewer

**Files:**
- Modify: `src/protocols/aerodrome/types.ts`
- Modify: `src/protocols/aerodrome/decrease.ts`
- Create: `tests/unit/protocols/aerodrome/exit-ops.test.ts`

**Diagnosis:** O `decreaseLiquidity` do Aerodrome (`decrease.ts:34-35`) só aceita mins absolutos; ausentes caem em `0n` → zero proteção de slippage na saída (exposição a MEV). O path Uniswap v3 (`uniswap-v3/decrease.ts:44-64`) resolve isso simulando `decreaseLiquidity` com mins `0n`, pegando os amounts estimados do `result` e aplicando `applySlippage`. O ABI Aerodrome (`aerodrome-npm.ts:78-84`) tem `decreaseLiquidity` com `outputs: [amount0, amount1]` → o mesmo padrão de simulação funciona, **sem** precisar de `getAmountsForLiquidity` (math Q96) nem read de `positions()`/`slot0`. **Desvio consciente da descrição literal da issue #4**, que assumia a necessidade de um primitivo Q96 — desnecessário porque o path de referência (Uniswap) usa simulação, não math off-chain.

**Verification:** `npm run build && npx vitest run tests/unit/protocols/aerodrome/`

**Prompt for subagent (Agent tool):**
```
Projeto: /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3 (lib @fsa-tools/web3, TypeScript ESM/NodeNext, viem, vitest).

Tarefa: adicionar suporte a `slippageBps?: number` no `decreaseLiquidity` do Aerodrome, com a MESMA semântica do Uniswap v3 — quando presente e os mins ausentes, computar `amount0Min`/`amount1Min` internamente; mins explícitos têm precedência (override). Issue #4.

ABORDAGEM (decidida — NÃO implemente math Q96): espelhe o path Uniswap v3, que NÃO usa `getAmountsForLiquidity`. Ele simula `decreaseLiquidity` com mins `0n`, lê os amounts estimados do resultado e aplica slippage. Referência exata em `src/protocols/uniswap-v3/decrease.ts` (linhas 44-64):
```ts
const { result } = await withRetry(() =>
  publicClient.simulateContract({
    address: npmAddress,
    abi: NPM_ABI,
    functionName: "decreaseLiquidity",
    args: [{ tokenId, liquidity, amount0Min: 0n, amount1Min: 0n, deadline: effectiveDeadline }],
    account: walletClient.account,
  }),
);
const [estimatedAmount0, estimatedAmount1] = result;
const amount0Min = applySlippage(estimatedAmount0, slippageBps);
const amount1Min = applySlippage(estimatedAmount1, slippageBps);
```
`applySlippage` vem de `src/math/slippage.ts` — `applySlippage(amount: bigint, slippageBps: number): bigint`, já valida range [0, 10000] e lança `SlippageExceededError`.

Estado atual do Aerodrome:
- `src/protocols/aerodrome/types.ts` — `DecreaseOperationParams` = `{ npmAddress: Address; nftId: bigint; liquidity: bigint; amount0Min?: bigint; amount1Min?: bigint; deadline?: bigint; gasOptions?: GasOptions; }`.
- `src/protocols/aerodrome/decrease.ts` — usa `walletClient.writeContract(...)` direto (NÃO usa plan/sendTxRequest como o Uniswap); mins caem em `params.amount0Min ?? 0n` / `params.amount1Min ?? 0n` (linhas 34-35). O ABI é `AERODROME_NPM_ABI` de `src/abis/aerodrome-npm.js`; a função `decreaseLiquidity` tem `outputs: [amount0, amount1]` e é `payable` — `simulateContract` funciona (callStatic).

Mudanças:
1. `types.ts`: adicione `slippageBps?: number;` ao `DecreaseOperationParams` do Aerodrome (opcional, mantendo os campos existentes intactos).
2. `decrease.ts`: quando `params.slippageBps` estiver definido E os mins correspondentes ausentes, derive os mins por simulação antes do `writeContract`:
   - Simule `decreaseLiquidity` no `params.npmAddress` com `AERODROME_NPM_ABI`, args com `amount0Min: 0n, amount1Min: 0n` e o `deadline` já computado, `account: walletClient.account`. Reutilize o helper `withRetry` de `src/utils/retry.js` (mesmo import que o Uniswap usa) para envolver a simulação.
   - Do `result` (tupla `[estimatedAmount0, estimatedAmount1]`), aplique `applySlippage(estimated, params.slippageBps)` para cada.
   - Precedência (override): use `params.amount0Min` se fornecido, senão o valor derivado, senão `0n`. Idem `amount1Min`. Ou seja: explícito > derivado de slippageBps > `0n`. Se `slippageBps` ausente, comportamento atual inalterado (`?? 0n`).
   - Importe `applySlippage` de `../../math/slippage.js` e `withRetry` de `../../utils/retry.js` (siga a convenção de extensão `.js` nos imports relativos — regra ESM/NodeNext do projeto). Ordene imports conforme o restante do arquivo.
   - Valide `slippageBps` implicitamente via `applySlippage` (ele já lança `SlippageExceededError` fora de [0,10000]); não adicione validação duplicada a menos que o Uniswap decrease faça — ele valida antes com `MAX_SLIPPAGE_BPS = 5000`; NÃO copie esse limite mais estrito para o Aerodrome, deixe `applySlippage` (limite 10000) governar, para não divergir sem pedido. (Se em dúvida, mantenha só `applySlippage`.)
   - NÃO altere o fluxo pós-`writeContract` (waitForTransactionReceipt, parse do DECREASE_TOPIC, return). NÃO troque `writeContract` por plan/sendTxRequest.

Testes — crie `tests/unit/protocols/aerodrome/exit-ops.test.ts` seguindo EXATAMENTE o padrão de `tests/unit/protocols/uniswap-exit-ops.test.ts` (leia-o antes): um `mockCtx()` que devolve um `ChainContext` com `publicClient.simulateContract: vi.fn(async () => ({ result: [<est0>, <est1>] }))`, `publicClient.waitForTransactionReceipt: vi.fn(async () => ({ gasUsed, logs: [] }))`, e `walletClient.writeContract: vi.fn(async (p) => { capture(p); return "0xhash"; })`. Casos:
  - **deriva mins de slippageBps**: com `simulateContract` retornando `result: [1000n, 2000n]` e `slippageBps: 50` (0.5%), asserta que `writeContract` foi chamado com `args[0].amount0Min === applySlippage(1000n, 50)` e `amount1Min === applySlippage(2000n, 50)` (importe `applySlippage` real de `src/math/slippage.js` para computar o esperado, ou calcule o literal). Use `.args` da chamada capturada.
  - **override**: com `slippageBps: 50` MAS `amount0Min: 999n` explícito, asserta que `writeContract` recebeu `amount0Min === 999n` (explícito vence) e `amount1Min` derivado da simulação.
  - **retrocompat sem slippageBps**: sem `slippageBps` e sem mins → `writeContract` recebe `amount0Min === 0n` e `amount1Min === 0n`, e `simulateContract` NÃO é chamado (asserte `simulateContract` toHaveBeenCalledTimes(0)).
  Envolva a chamada em try/catch se o parse pós-receipt lançar com logs vazios (padrão do teste Uniswap: "só o roteamento/args importa"). Os valores de teste devem ser ordem de grandeza real (wei/liquidity plausíveis), conforme regra de testes financeiros do projeto.

Restrições:
- Mudança cirúrgica: só os 3 arquivos listados. NÃO crie `getAmountsForLiquidity`, NÃO toque `src/math/*`, NÃO leia `positions()`/`slot0`.
- Sem `any`, sem `@ts-ignore`, sem console.log, sem código comentado.
- Path financeiro (proteção de slippage/MEV) — cobertura de teste 100% da lógica nova de derivação e override.

Verificação (rode antes de retornar): `npm run build && npx vitest run tests/unit/protocols/aerodrome/` → tsc sem erros, novos testes verdes (e os de aerodrome existentes — plan/quote/swap — continuam passando).

Retorne quando: build limpo e os testes de aerodrome passam 100%. No retorno, mostre o diff do `decrease.ts` (trecho da derivação de mins) e confirme que a precedência explícito > derivado > 0n está coberta por teste.
```

## Launch order (DAG resolved)

### Phase 0 — parallel

- Cluster 1 / Task 1.1 (is429 — #5)
- Cluster 1 / Task 1.2 (aerodrome slippageBps — #4) +reviewer

**Fan-out Phase 0: 2 parallel tasks**

## Notas de fechamento (pós-execução)

- Projeto é lib pura (não-hermes) → ambas as issues fecham **host-side por você (Claude)** após DoD verde + review de A2 limpo.
- Ao commitar, referencie com `ref #5` / `ref #4` (nunca `Closes/Fixes` — o gate de fechamento é seu via `/issues close`).
- Rodada de lib → fechar com `/done --version` + `/publish` (semver: ambas são `feat`/`fix` opt-in retrocompatível → minor bump).
