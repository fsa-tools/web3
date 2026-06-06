# Plan — approvalMode exato (opt-in) em ensureAllowance

## Metadata

- **Generated:** 2026-06-06
- **Worktree:** recommended
- **Issue:** `fsa-tools/web3#2`

## Context

Projeto raiz: `/Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3` (lib `@fsa-tools/web3`,
publicada no GitHub Packages). TypeScript ESM (`NodeNext`), runner Vitest. Sem subprojetos.
A lib expõe utilitários on-chain (viem) e fluxos de protocolo (uniswap-v3, aerodrome, aave).

## Baseline (current state)

```bash
# ensureAllowance concede approval ILIMITADO (MAX_UINT256) — único ponto com o problema:
grep -n "MAX_UINT256" src/utils/erc20.ts        # → linha 6 (const) e ~62 (approve final)
# Call sites runtime que herdam o ilimitado (4):
grep -rn "ensureAllowance(ctx" src/protocols/   # uniswap-v3/{mint,swap}, aerodrome/{mint,swap}
# aave NÃO usa ensureAllowance (modelo plan, já approve(amount) exato) — fora do escopo.
npm test && npm run typecheck                    # baseline verde antes de começar
```

## Objective

Adicionar um modo de approval **exato** opt-in (`approvalMode: 'exact'`) em `ensureAllowance`,
mantendo `'unlimited'` (MAX_UINT256) como default — zero breaking change — e propagar a flag
pelos fluxos mint/swap de uniswap-v3 e aerodrome.

## Definition of Done (global)

```bash
npm test && npm run typecheck
```

**Expected output:** Vitest reporta todos os arquivos `passed` (0 failed) e `tsc` sai sem erros.

## Policy (invariant)

- **Default inalterado:** sem `approvalMode`, o comportamento é `'unlimited'` → `approve(spender, MAX_UINT256)`. Nenhum consumidor pode quebrar.
- **Preservar a mitigação de approval-race:** o reset `approve(spender, 0n)` com `waitForTransactionReceipt({ confirmations: 2 })` quando `allowance > 0` permanece EXATAMENTE como está (`src/utils/erc20.ts:48-58`). Não tocar.
- **Não esperar receipt no approve final:** o approve final hoje retorna `txHash` sem `waitForTransactionReceipt` — manter assim (a issue descreve "2 confs no approve final" incorretamente; as 2 confs são só do reset).
- **aave fora de escopo.** Não tocar `src/protocols/aave/*` (já usa `approve(amount)` exato via modelo plan).
- **Caminho `plan*` fora de escopo.** `plan.ts` de uniswap/aerodrome já usa `approve(amount)` exato — não alterar.
- **Estilo:** TypeScript estrito, `type` para uniões, sem `any`, imports relativos com `.js`. Match exato do estilo vizinho. Mudança cirúrgica mínima.
- **TDD:** teste antes da implementação onde a task pede testes.

## Dependency justification

- **Cluster 3 blockedBy Cluster 1:** a propagação (C3) passa `approvalMode` para `ensureAllowance` e seus testes assertam `approve(amount)` no modo `exact`. Isso só funciona depois que C1 (a) adiciona o campo `approvalMode` a `EnsureAllowanceParams`, (b) implementa o branch `exact`, e (c) exporta o tipo `ApprovalMode`. Sem C1, os testes de C3 falham e o tipo não existe. Stub do tipo pouparia pouco (a dependência de comportamento de runtime permanece) → mantido sequencial.
- **Cluster 2 (README):** independente — documenta a API já fixada por este plano, não consome artefato de código.

## Clusters

### Cluster 1 — Core approval mode

**Inter-cluster dependency:** none

#### Task 1.1: approvalMode em ensureAllowance + testes core (TDD) [opus] +reviewer

**Files:**
- Modify: `src/utils/erc20.ts`
- Modify: `src/utils/index.ts` (exportar o tipo `ApprovalMode`, junto de `ensureAllowance`)
- Create: `tests/unit/utils/erc20.test.ts`

**Diagnosis:** `ensureAllowance` (`src/utils/erc20.ts:24`) sempre chama `approve(spender, MAX_UINT256)` (linha ~62). Adicionar união `ApprovalMode = 'exact' | 'unlimited'`, campo opcional `approvalMode?: ApprovalMode` em `EnsureAllowanceParams` (default `'unlimited'`), e selecionar o valor do approve final: `exact`→`amount`, `unlimited`→`MAX_UINT256`. Tudo o mais (guard `amount===0n`, leitura de allowance, early-return `allowance>=amount`, reset `approve(0)`+2confs) permanece.

**Verification:** `npx vitest run tests/unit/utils/erc20.test.ts && npm run typecheck`

**Prompt for subagent (Agent tool):**
```
Você está em /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3 (lib @fsa-tools/web3, TypeScript ESM NodeNext, runner Vitest).

TAREFA (TDD — escreva o teste primeiro, veja-o falhar, depois implemente):
Adicionar um modo de approval EXATO opt-in em `ensureAllowance`, mantendo o ilimitado (MAX_UINT256) como default.

Arquivo central: src/utils/erc20.ts. Estado atual relevante:
- `const MAX_UINT256 = 2n ** 256n - 1n;` (linha 6)
- `export type EnsureAllowanceParams = { token: Address; spender: Address; amount: bigint; };`
- `ensureAllowance(ctx, params)`: valida endereços; se `amount===0n` retorna `{approved:false}`; lê allowance atual; se `allowance>=amount` retorna `{approved:false}`; se `allowance>0` faz `approve(spender,0n)` + `waitForTransactionReceipt({confirmations:2})`; por fim faz `approve(spender, MAX_UINT256)` e retorna `{approved:true, txHash}` (SEM esperar receipt no approve final).

MUDANÇAS:
1. Adicione `export type ApprovalMode = "exact" | "unlimited";`
2. Adicione `approvalMode?: ApprovalMode;` a `EnsureAllowanceParams` (campo OPCIONAL).
3. No approve FINAL, selecione o valor: `const approveAmount = (params.approvalMode ?? "unlimited") === "exact" ? amount : MAX_UINT256;` e use `args: [spender, approveAmount]`.
4. Em src/utils/index.ts, exporte o tipo `ApprovalMode` (export type) no mesmo agrupamento onde `ensureAllowance`/`EnsureAllowanceParams` são exportados. Leia o arquivo antes para copiar o padrão de export exato.

INVARIANTES (não viole):
- Default (sem `approvalMode`) DEVE continuar `approve(spender, MAX_UINT256)`.
- O reset `approve(spender, 0n)` + `waitForTransactionReceipt({confirmations:2})` quando `allowance>0` permanece IDÊNTICO.
- O approve final continua SEM `waitForTransactionReceipt`.
- Guard `amount===0n` → `{approved:false}` e early-return `allowance>=amount` → `{approved:false}` permanecem.
- Não toque em `getBalance` nem em nenhum outro arquivo além dos dois listados.

TESTES — crie tests/unit/utils/erc20.test.ts (Vitest + vi). Use um mock de ChainContext que CAPTURE os args do approve (a função e o amount), inspirado no padrão de tests/unit/protocols/mint-approve.test.ts (LEIA-O antes para copiar o estilo de mock: publicClient.readContract/waitForTransactionReceipt e walletClient.writeContract via vi.fn). ATENÇÃO: o mock daquele arquivo captura só {address, functionName}; aqui você PRECISA capturar também args[1] (o amount aprovado).
Casos obrigatórios (1 comportamento por teste, nomes "should ... when ..."):
  a) default (sem approvalMode), allowance=0 → approve final com amount === MAX_UINT256 (2n**256n-1n).
  b) approvalMode:"unlimited" explícito, allowance=0 → approve final com MAX_UINT256.
  c) approvalMode:"exact", allowance=0 → approve final com amount === o `amount` passado.
  d) approvalMode:"exact", allowance>0 (ex.: 5n) e <amount → faz approve(0n) ANTES e depois approve(amount); confirma os 2 writes na ordem e que o reset foi 0n.
  e) amount===0n → retorna {approved:false}, nenhum write.
  f) allowance>=amount → retorna {approved:false}, nenhum write.

RESTRIÇÕES:
- Não altere config, package.json, nem outros testes.
- Sem `any` (use `unknown` + cast como no mock de referência). Imports relativos com `.js`.

OUTPUT a retornar: arquivos tocados, resumo das mudanças, e a saída final de:
  npx vitest run tests/unit/utils/erc20.test.ts && npm run typecheck

Return when `npx vitest run tests/unit/utils/erc20.test.ts && npm run typecheck` exits 0.
```

### Cluster 2 — Documentation

**Inter-cluster dependency:** none

#### Task 2.1: Seção approvalMode no README [sonnet]

**Files:**
- Modify: `README.md`

**Diagnosis:** README tem seção `## Segurança` (linha ~140) e cita `ensureAllowance(ctx, { token, spender, amount })` na tabela de migração (linha ~105). Falta documentar o novo opt-in `approvalMode` e o trade-off segurança×gas.

**Verification:** `grep -q "approvalMode" README.md && grep -q "exact" README.md`

**Prompt for subagent (Agent tool):**
```
Você está em /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3. Edite SOMENTE README.md.

TAREFA: Documentar o novo parâmetro opt-in `approvalMode` da lib @fsa-tools/web3.

CONTEXTO (a API já está definida — apenas documente, não implemente nada):
- `ensureAllowance(ctx, { token, spender, amount, approvalMode? })` aceita `approvalMode?: "exact" | "unlimited"`.
- Default `"unlimited"` → `approve(spender, MAX_UINT256)` (comportamento atual, retrocompatível).
- `"exact"` → `approve(spender, amount)`: mais seguro (não deixa allowance ilimitada para o spender), mas custa um `approve` por operação (não reaproveita allowance entre entradas) — trade-off segurança×gas consciente, escolha do consumidor.
- A flag também é aceita nos params de protocolo: `MintOperationParams` e `SwapOperationParams` de uniswap-v3 e aerodrome (mesmo default `"unlimited"`), repassada internamente a `ensureAllowance`.
- aave NÃO é afetado (já usa approve exato via modelo plan).

INSTRUÇÕES:
1. LEIA o README.md inteiro primeiro. Encontre a seção `## Segurança` e a tabela/menção a `ensureAllowance`.
2. Adicione uma subseção (ex.: `### Approval mode (allowance exata vs. ilimitada)`) dentro de `## Segurança`, ou logo após a menção a `ensureAllowance`, explicando os dois modos, o default, e o trade-off segurança×gas. Inclua um pequeno exemplo de código mostrando `approvalMode: "exact"` em `ensureAllowance` e em `mintPosition` (uniswap-v3).
3. Match EXATO do estilo do README (tom, formatação de code blocks, idioma pt-BR onde o doc já usa pt-BR).

RESTRIÇÕES: nenhum outro arquivo. Não reescreva seções existentes — só ADICIONE a doc do approvalMode (edição mínima).

OUTPUT a retornar: trecho adicionado e confirmação de:
  grep -q "approvalMode" README.md && grep -q "exact" README.md

Return when `grep -q "approvalMode" README.md && grep -q "exact" README.md` exits 0.
```

### Cluster 3 — Protocol propagation

**Inter-cluster dependency:** depends on Cluster 1

#### Task 3.1: Propagar approvalMode por uniswap-v3 + aerodrome (mint+swap) + testes [sonnet] +reviewer

**Intra-cluster dependency:** none

**Files:**
- Modify: `src/protocols/uniswap-v3/types.ts` (`MintOperationParams`, `SwapOperationParams`)
- Modify: `src/protocols/aerodrome/types.ts` (`MintOperationParams`, `SwapOperationParams`)
- Modify: `src/protocols/uniswap-v3/mint.ts` (2 call sites: linhas 39, 44)
- Modify: `src/protocols/uniswap-v3/swap.ts` (1 call site: linha 44)
- Modify: `src/protocols/aerodrome/mint.ts` (2 call sites: linhas 30, 35)
- Modify: `src/protocols/aerodrome/swap.ts` (1 call site: linha 46)
- Create: `tests/unit/protocols/approval-mode-propagation.test.ts`

**Diagnosis:** os 4 fluxos chamam `ensureAllowance(ctx, { token, spender, amount })` sem `approvalMode`. Adicionar `approvalMode?: ApprovalMode` aos params de operação (mint+swap) de ambos os protocolos e repassar `approvalMode: params.approvalMode` (uniswap) / `approvalMode` (aerodrome, conforme desestruturação local) em cada call site. Default permanece `'unlimited'` (omitido → ensureAllowance aplica o default).

**Verification:** `npx vitest run tests/unit/protocols/ && npm run typecheck`

**Prompt for subagent (Agent tool):**
```
Você está em /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3 (TypeScript ESM, Vitest).

PRÉ-REQUISITO já existente (NÃO reimplemente): src/utils/erc20.ts exporta
`export type ApprovalMode = "exact" | "unlimited";` e `ensureAllowance` aceita
`approvalMode?: ApprovalMode` em EnsureAllowanceParams (default "unlimited"). Confirme com:
  grep -n "ApprovalMode" src/utils/erc20.ts
Se não existir, PARE e reporte (a Task 1.1 não rodou).

TAREFA: propagar a flag `approvalMode` pelos fluxos mint+swap de uniswap-v3 e aerodrome,
repassando-a a ensureAllowance. Default permanece "unlimited" (campo opcional, omissão → default).

MUDANÇAS (cirúrgicas, mínimas):
1. Importe o tipo: em cada arquivo que precisar, use `import type { ApprovalMode } from "../../utils/erc20.js";` (confirme o caminho relativo correto a partir de src/protocols/<proto>/).
2. src/protocols/uniswap-v3/types.ts:
   - `MintOperationParams`: adicione `approvalMode?: ApprovalMode;`
   - `SwapOperationParams`: adicione `approvalMode?: ApprovalMode;`
3. src/protocols/aerodrome/types.ts: idem nas DUAS (`MintOperationParams`, `SwapOperationParams`).
4. Call sites — adicione `approvalMode: params.approvalMode` (ou `approvalMode` se já desestruturado de params no escopo) ao objeto passado a ensureAllowance:
   - src/protocols/uniswap-v3/mint.ts: os 2 `ensureAllowance(ctx, {...})` (token0 e token1).
   - src/protocols/uniswap-v3/swap.ts: o 1 `ensureAllowance(ctx, {...})` (tokenIn). Obs: este arquivo desestrutura params; use a forma consistente com o estilo local (ex.: incluir `approvalMode` na desestruturação OU usar `params.approvalMode`).
   - src/protocols/aerodrome/mint.ts: os 2 `ensureAllowance(ctx, {...})`.
   - src/protocols/aerodrome/swap.ts: o 1 `ensureAllowance(ctx, {...})`.
   LEIA cada arquivo antes de editar e copie o estilo (params.x vs desestruturação).

INVARIANTES:
- Campo OPCIONAL, default "unlimited". Não mude nenhum outro comportamento (slippage, deadline, quote, receipts).
- NÃO toque em aave, nem nos plan.ts, nem em erc20.ts.
- Sem `any`. Imports relativos com `.js`. Match exato do estilo vizinho.

TESTES — crie tests/unit/protocols/approval-mode-propagation.test.ts (Vitest + vi).
LEIA tests/unit/protocols/mint-approve.test.ts para copiar o padrão de mock (publicClient/walletClient via vi.fn), mas ESTENDA o mock para capturar args[1] (o amount aprovado) de cada writeContract de `approve`.
Casos obrigatórios:
  a) uniswap-v3 mintPosition com approvalMode:"exact" → os approves de token0/token1 usam amount === amount0Desired/amount1Desired (NÃO MAX_UINT256).
  b) uniswap-v3 mintPosition SEM approvalMode → approves usam MAX_UINT256 (2n**256n-1n) — guarda do default.
  c) uniswap-v3 swapExactInputSingle com approvalMode:"exact" → approve de tokenIn usa amount === amountIn.
  d) aerodrome mintPosition com approvalMode:"exact" → approves usam os amounts desired (envolva em try/catch se o parse de log lançar, como faz mint-approve.test.ts; asserte sobre os approves capturados).
  e) aerodrome swapExactInputSingle com approvalMode:"exact" → approve de tokenIn usa amountIn.
Para fluxos que exigem quote/router (swaps), mocke o publicClient.readContract/simulateContract conforme necessário para não bater em rede — inspecione quote.ts de cada protocolo para saber o que mockar; se o swap for difícil de mockar até o approve, basta garantir que o approve ocorre com o amount certo ANTES de qualquer falha posterior (capture os calls e asserte só sobre o approve).

RESTRIÇÕES: não altere config/package.json/outros testes.

OUTPUT a retornar: arquivos tocados, resumo, e a saída final de:
  npx vitest run tests/unit/protocols/ && npm run typecheck

Return when `npx vitest run tests/unit/protocols/ && npm run typecheck` exits 0.
```

## Launch order (DAG resolved)

### Phase 0 — parallel

- Cluster 1 / Task 1.1 (core, opus, +reviewer)
- Cluster 2 / Task 2.1 (README, sonnet)

**Fan-out Phase 0: 2 parallel tasks**

### Phase 1 — after Cluster 1 completes

- Cluster 3 / Task 3.1 (propagation, sonnet, +reviewer)

## Notes / divergências da issue (verificadas no código)

- aave **não** usa `ensureAllowance` (modelo plan, `approve(amount)` já exato) → fora do escopo, ao contrário do que a issue sugere.
- `plan.ts` de uniswap/aerodrome já usam `approve(amount)` exato → fora do escopo. O MAX_UINT256 é exclusivo de `ensureAllowance`.
- A issue diz "espera 2 confirmações no approve final" — incorreto: as 2 confs são só do reset `approve(0)`; o approve final retorna txHash sem esperar receipt. Mantido como está.
- Critério de aceite da issue "preservar 2 confs" → atendido como "preservar o reset `approve(0)`+2confs".
```