# Plan — Expor os receipts dos approves em SwapResult/PositionResult

## Metadata

- **Generated:** 2026-07-13
- **Worktree:** none
- **Issue:** fsa-tools/web3#7

## Context

Raiz: `/Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3` — lib TypeScript ESM
(`@fsa-tools/web3`, v3.8.0), publicada no GitHub Packages. Wrappers viem para
Uniswap V3 / Aerodrome / Aave V3. Testes em Vitest (`tests/unit/**`), tipos em
`strict`. Branch atual: `main` — criar `feat/approval-receipts` antes de editar.

## Baseline (current state)

```bash
# ensureAllowance descarta os dois receipts que ela mesma espera:
sed -n '50,72p' src/utils/erc20.ts
# 4 call sites descartam o retorno de ensureAllowance por completo:
grep -rn "await ensureAllowance" src/protocols/
# nenhum result carrega dado de approve:
grep -rn "approvalReceipts" src/ ; echo "exit=$?"   # exit=1 (nada)
```

Estado: `mintPosition` e `swapExactInputSingle` (ambos os protocolos) disparam
approves ERC20 internamente via `ensureAllowance`. Essas txs gastam gás e o
consumidor nunca fica sabendo que existiram — `PositionResult`/`SwapResult` só
carregam `txHash`/`gasUsed`/`effectiveGasPrice` da tx principal. O custo de
entrada calculado pelo `claw-yield` subestima o gás, com viés sistemático e
sempre para baixo.

Agravante encontrado na exploração: `ensureAllowance` pode emitir **duas** txs —
o reset-para-zero (`src/utils/erc20.ts:51`, quando a allowance corrente é > 0 mas
< amount) e o approve final (`:64`). Ela dá `waitForTransactionReceipt` nas duas
(`:57` e `:70`) e **descarta ambos os receipts**. O hash do reset não é exposto
nem no `AllowanceResult` de hoje.

## Objective

Devolver ao chamador os receipts das txs de approve disparadas internamente, para
que ele feche a contabilidade de gás sem nenhuma chamada RPC adicional.

## Definition of Done (global)

```bash
npm run typecheck && npm test
```

**Expected output:** `tsc` sem erros e a linha final do Vitest com `failed` ausente
(ex.: `Test Files  N passed (N)` / `Tests  M passed (M)`).

## Policy (invariant)

- **Abordagem escolhida: receipts inteiros, não hashes.** `ensureAllowance` já
  espera os receipts e os joga fora. Devolvê-los custa **zero RPC extra** e entrega
  `gasUsed`, `effectiveGasPrice` e (na Base/OP-stack, via chain formatter do viem)
  `l1Fee`. Devolver só hashes forçaria o consumidor a rebuscar cada receipt —
  exatamente o custo que o commit `aabcb17` acabou de eliminar para a tx principal.
- **`l1Fee` não é estático.** O tipo `TransactionReceipt` do viem não declara
  `l1Fee`; o campo chega em runtime pelo chain formatter. Decisão do operador:
  **aceitar o cast do lado do consumidor** — não vazar generics de chain para a API
  pública da lib. Documentar isso no CHANGELOG.
- **Campo sempre presente, nunca opcional.** `approvalReceipts: TransactionReceipt[]`
  — array vazio quando nenhum approve foi disparado. Sem `?`, sem `undefined`: a
  ausência seria ambígua (não aprovou? versão velha da lib?).
- **Não-breaking no `AllowanceResult`.** O campo `txHash?: Hash` existente permanece
  intacto e com o mesmo significado (o approve **final**). O campo novo é somado, não
  substitui.
- **Aave está fora de escopo.** `src/protocols/aave/supply.ts` não chama
  `ensureAllowance` — o approve vem no plano e é responsabilidade do caller. Não há
  gás invisível lá. Não tocar em `src/protocols/aave/**`.
- **Só mint e swap.** `decrease`, `collect`, `burn` e `quote` não aprovam nada. Seus
  result types (`DecreaseResult`, `CollectResult`, `BurnResult`, `QuoteResult`) ficam
  inalterados.
- **Não tocar `package.json`.** O bump de versão é do `/done`.
- **Mudança cirúrgica.** Zero refactor não solicitado, zero renomeação, zero
  reorganização de imports. Seguir o estilo do arquivo vizinho (ver como
  `effectiveGasPrice` foi propagado no commit `aabcb17` — mesmo padrão, mesmo tom de
  comentário em pt-BR sem acento nos comentários de código).

## Dependency justification

- **Cluster 2 blockedBy Cluster 1:** as tasks 2.1 e 2.2 leem `AllowanceResult.receipts`
  — o campo que a Task 1.1 cria em `src/utils/erc20.ts`. Sem 1.1 o campo não existe e
  não há o que propagar. Handoff real de artefato (um campo de tipo público). Um stub
  não se justifica: 1.1 é pequena o bastante para ser o gargalo aceitável.
- **Cluster 3 blockedBy Cluster 2:** o CHANGELOG descreve a API final (nomes de campo,
  shape). Escrevê-lo antes da API existir convida divergência entre doc e código. Custo
  da serialização é baixo (haiku, 1 arquivo).
- **2.1 ∥ 2.2 (sem dependência):** zero overlap de arquivos — `src/protocols/uniswap-v3/*`
  vs `src/protocols/aerodrome/*`, e cada uma cria seu **próprio** arquivo de teste novo.
  Nenhuma das duas edita `tests/unit/protocols/mint-approve.test.ts` (que importa os dois
  protocolos e seria o único ponto de colisão).

## Clusters

### Cluster 1 — Contrato do ensureAllowance

**Inter-cluster dependency:** none

#### Task 1.1: Devolver os receipts dos approves em AllowanceResult [sonnet]

**Files:**
- Modify: `src/utils/erc20.ts`
- Modify: `tests/unit/utils/erc20.test.ts`

**Diagnosis:** `ensureAllowance` chama `waitForTransactionReceipt` duas vezes
(linha 57, no reset-para-zero; linha 70, no approve final) e descarta os dois
retornos. Basta capturá-los e devolvê-los num array, na ordem de envio.

**Verification:** `npx vitest run tests/unit/utils/erc20.test.ts`

**Prompt for subagent (Agent tool):**
```
Projeto: /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3
Lib TypeScript ESM (@fsa-tools/web3), viem + Vitest, tsconfig strict.

TAREFA
Fazer `ensureAllowance` devolver os receipts das transações de approve que ela
mesma dispara. Hoje ela os espera e os descarta.

ARQUIVO: src/utils/erc20.ts

Estado atual relevante (linhas 17-72):

    export type AllowanceResult = {
      approved: boolean;
      txHash?: Hash;
    };

    export async function ensureAllowance(
      ctx: ChainContext,
      params: EnsureAllowanceParams,
    ): Promise<AllowanceResult> {
      ...
      if (amount === 0n) {
        return { approved: false };
      }
      const currentAllowance = await publicClient.readContract({ ... });
      if (currentAllowance >= amount) {
        return { approved: false };
      }
      if (currentAllowance > 0n) {
        const resetHash = await walletClient.writeContract({ ...approve(spender, 0n) });
        await publicClient.waitForTransactionReceipt({      // <-- receipt DESCARTADO
          hash: resetHash,
          confirmations: 2,
        });
      }
      const approveAmount = ... ;
      const txHash = await walletClient.writeContract({ ...approve(spender, approveAmount) });
      await publicClient.waitForTransactionReceipt({ hash: txHash });   // <-- receipt DESCARTADO
      return { approved: true, txHash };
    }

MUDANÇAS EXIGIDAS

1. `AllowanceResult` ganha um campo NOVO, sempre presente:

    export type AllowanceResult = {
      approved: boolean;
      txHash?: Hash;                    // INALTERADO: hash do approve FINAL
      receipts: TransactionReceipt[];   // NOVO: receipts das txs de approve, na ordem de envio
    };

   - Importar `TransactionReceipt` de "viem" como type-only import, junto do
     `import type { Address, Hash } from "viem";` que já existe na linha 1.
   - `receipts` é OBRIGATÓRIO (sem `?`). Quando nenhum approve foi disparado, é `[]`.
   - NÃO remover nem alterar a semântica de `txHash` — ele continua sendo o hash do
     approve final. Isso é não-breaking por decisão de design.

2. Capturar os dois receipts:
   - O receipt do reset-para-zero (o `waitForTransactionReceipt` de dentro do
     `if (currentAllowance > 0n)`) — hoje totalmente perdido.
   - O receipt do approve final.
   - Devolvê-los em `receipts` NA ORDEM DE ENVIO: `[resetReceipt, finalReceipt]` quando
     houve reset; `[finalReceipt]` quando não houve.

3. Os dois early-returns (`amount === 0n` e `currentAllowance >= amount`) passam a
   devolver `{ approved: false, receipts: [] }`.

RESTRIÇÕES
- NÃO tocar em nenhum outro arquivo. Os call sites em src/protocols/** são de outra task.
- NÃO alterar `getBalance`, `EnsureAllowanceParams`, `ApprovalMode` nem `MAX_UINT256`.
- NÃO mudar a lógica de decisão (quando aprova, quanto aprova, o reset condicional,
  `confirmations: 2` no reset) — só a captura e o retorno dos receipts.
- Mudança cirúrgica: sem refactor, sem renomeação, sem reorganizar imports.
- Comentários de código no projeto são em pt-BR e SEM acento. Só comente se houver
  uma constraint que o código não mostra sozinho.

TESTES: tests/unit/utils/erc20.test.ts (já existe, 7 testes passando)
O mock `buildMockContext(currentAllowance)` de lá tem
`waitForTransactionReceipt: vi.fn(async (p) => { waits.push({hash: p.hash}); return {}; })`
— devolve `{}`, um receipt vazio. E `writeContract` devolve SEMPRE o hash fixo "0xabc",
o que torna impossível distinguir o reset do approve final.

Ajustar o mock para que os testes novos sejam significativos:
- `writeContract` devolve hashes DISTINTOS por chamada (ex.: um contador → "0x1", "0x2").
- `waitForTransactionReceipt` devolve um receipt identificável a partir do hash recebido
  (ex.: `{ transactionHash: p.hash, gasUsed: 50_000n, effectiveGasPrice: 1_000n }`),
  para que o teste consiga afirmar QUAL receipt veio em QUE posição do array.
- Preservar os 7 testes existentes e o que eles afirmam. O teste
  "should wait for the final approve receipt before returning" afirma
  `expect(result.txHash).toBe("0xabc")` — ao trocar o hash do mock, ajuste a expectativa
  para o novo hash do approve final, mantendo a INTENÇÃO do teste intacta.

Adicionar testes cobrindo os 3 caminhos de `receipts`:
- amount = 0n            → `receipts` é `[]`
- allowance suficiente   → `receipts` é `[]`
- allowance = 0, aprova  → `receipts` tem 1 item, o receipt do approve final
- allowance > 0 e < amount (caminho do reset, approvalMode "exact")
                         → `receipts` tem 2 itens, NA ORDEM [reset, final];
                           assertar que o 1º corresponde à tx de approve(spender, 0n)
                           e o 2º à de approve(spender, amount)

Seguir o estilo dos testes existentes no arquivo: `describe`/`it` com nomes
"should <resultado> when <condição>", `vi.fn`, mocks via `as unknown as ChainContext[...]`.

RETORNO
Devolva: (a) o diff conceitual do que mudou em cada arquivo, (b) quantos testes passam,
(c) qualquer decisão não-óbvia que você tomou.

Retorne quando `npx vitest run tests/unit/utils/erc20.test.ts` sair com exit 0.
```

### Cluster 2 — Propagação nos protocolos

**Inter-cluster dependency:** depends on Cluster 1

#### Task 2.1: Propagar approvalReceipts no uniswap-v3 [sonnet]

**Files:**
- Modify: `src/protocols/uniswap-v3/types.ts`
- Modify: `src/protocols/uniswap-v3/mint.ts`
- Modify: `src/protocols/uniswap-v3/swap.ts`
- Create: `tests/unit/protocols/approval-receipts-uniswap.test.ts`

**Diagnosis:** `mint.ts:39,45` (dois approves) e `swap.ts:52` (um approve) chamam
`ensureAllowance` com `await` e descartam o retorno. Basta capturar, concatenar os
`receipts` na ordem de envio, e devolver no result.

**Verification:** `npx vitest run tests/unit/protocols/approval-receipts-uniswap.test.ts tests/unit/protocols/swap.test.ts tests/unit/protocols/uniswap-exit-ops.test.ts`

> Nota: `mint-approve.test.ts` e `approval-mode-propagation.test.ts` importam **os dois
> protocolos** e ficam de fora deste DoD de propósito — a Task 2.2 roda em paralelo na
> mesma working tree e um arquivo do Aerodrome apanhado no meio da escrita faria este
> comando falhar espúrio. Eles são cobertos pelo DoD global, com tudo já estável.

**Prompt for subagent (Agent tool):**
```
Projeto: /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3
Lib TypeScript ESM (@fsa-tools/web3), viem + Vitest, tsconfig strict.

CONTEXTO — o que já mudou (feito por outra task, já commitado/aplicado)
`src/utils/erc20.ts` agora expõe:

    export type AllowanceResult = {
      approved: boolean;
      txHash?: Hash;                    // hash do approve final
      receipts: TransactionReceipt[];   // receipts das txs de approve, na ordem de envio; [] se nao aprovou
    };
    export async function ensureAllowance(ctx, params): Promise<AllowanceResult>

`receipts` pode ter 0, 1 ou 2 itens (2 quando houve reset-para-zero antes do approve).
Confirme lendo `src/utils/erc20.ts` antes de começar.

TAREFA
Propagar esses receipts até os results do protocolo UNISWAP V3. Motivo: mintPosition e
swapExactInputSingle disparam approves ERC20 internamente; essas txs gastam gás e hoje o
consumidor nem sabe que existiram, então o custo de entrada dele subestima o gás.

ARQUIVO 1: src/protocols/uniswap-v3/types.ts
`PositionResult` e `SwapResult` ganham um campo NOVO, sempre presente:

    approvalReceipts: TransactionReceipt[];

- Sem `?`. Array vazio quando nenhum approve foi disparado.
- Importar `TransactionReceipt` de "viem" no `import type { Address, Hash } from "viem";`
  já existente na linha 1.
- Só `PositionResult` e `SwapResult`. NÃO tocar em `DecreaseResult`, `CollectResult`,
  `BurnResult` nem `QuoteResult` — essas operações não aprovam nada.
- Comente o campo no MESMO estilo do comentário que já acompanha `effectiveGasPrice`
  nesses tipos (pt-BR, sem acento, explicando o porquê e não o quê).

ARQUIVO 2: src/protocols/uniswap-v3/mint.ts
Linhas 39-50 fazem DOIS approves (token0 e token1) e descartam o retorno:

    await ensureAllowance(ctx, { token: params.token0, spender: npmAddress, ... });
    await ensureAllowance(ctx, { token: params.token1, spender: npmAddress, ... });

Capturar os dois retornos e concatenar os `receipts` NA ORDEM DE ENVIO
(todos os do token0, depois todos os do token1). Devolver o array no `return` final
(linha ~80) como `approvalReceipts`, ao lado de `txHash`/`gasUsed`/`effectiveGasPrice`.

ARQUIVO 3: src/protocols/uniswap-v3/swap.ts
Linha 52 faz UM approve (tokenIn) e descarta o retorno. Mesma coisa: capturar,
devolver `approvalReceipts` no return final (linha ~96).

RESTRIÇÕES
- NÃO tocar em src/protocols/aerodrome/** — é outra task rodando EM PARALELO com a sua,
  na mesma working tree. Editar lá causa conflito.
- NÃO tocar em src/protocols/aave/** (não usa ensureAllowance), nem em src/utils/erc20.ts.
- NÃO editar `tests/unit/protocols/mint-approve.test.ts` — ele importa OS DOIS protocolos
  e é o único ponto de colisão com a task paralela. Crie um arquivo de teste NOVO.
- NÃO alterar a lógica de approve, slippage, deadline, quote ou envio da tx principal.
  Só capturar e propagar os receipts.
- NÃO tocar em package.json.
- Mudança cirúrgica: sem refactor, sem renomeação, sem reorganizar imports.

TESTES: criar tests/unit/protocols/approval-receipts-uniswap.test.ts
Espelhe o estilo de `tests/unit/protocols/swap.test.ts` (leia-o antes): mock de
`publicClient`/`walletClient` via `vi.fn` + `as unknown as ChainContext[...]`.

ATENÇÃO ao mock — os mocks existentes NÃO servem como estão:
- `writeContract` é usado TANTO pelo approve QUANTO pela tx principal, e os mocks atuais
  devolvem sempre o mesmo hash fixo. Faça-o devolver hashes DISTINTOS por chamada.
- `waitForTransactionReceipt` nos mocks atuais devolve sempre o MESMO objeto de receipt.
  Faça-o devolver um receipt identificável pelo hash recebido (ex.:
  `{ transactionHash: p.hash, gasUsed: ..., effectiveGasPrice: ..., logs: [...] }`),
  para o teste conseguir afirmar QUAIS receipts vieram em `approvalReceipts` e que eles
  são os dos APPROVES, não o da tx principal.
- A tx de mint precisa do log `IncreaseLiquidity` no receipt (topic
  0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f) — veja como
  `tests/unit/protocols/mint-approve.test.ts` monta esse receipt e reaproveite a ideia.

Cobrir:
- swapExactInputSingle com allowance 0 → `approvalReceipts` tem 1 item (o do approve),
  e ele NÃO é o receipt da tx de swap.
- swapExactInputSingle com allowance suficiente → `approvalReceipts` é `[]`.
- mintPosition com allowance 0 nos dois tokens → `approvalReceipts` tem 2 itens, na
  ordem [approve token0, approve token1].
- mintPosition com allowance suficiente nos dois tokens → `approvalReceipts` é `[]`.

RETORNO
Devolva: (a) o que mudou em cada arquivo, (b) quantos testes passam, (c) decisões
não-óbvias que você tomou.

Retorne quando este comando sair com exit 0:
npx vitest run tests/unit/protocols/approval-receipts-uniswap.test.ts tests/unit/protocols/swap.test.ts tests/unit/protocols/uniswap-exit-ops.test.ts

NÃO rode a suíte inteira (`npm test`) nem `npm run typecheck` para se validar: outra task
está editando src/protocols/aerodrome/** ao mesmo tempo, e você veria falhas que NÃO são
suas. Se algum teste fora da lista acima falhar, NÃO conserte — reporte e retorne.
```

#### Task 2.2: Propagar approvalReceipts no aerodrome [sonnet]

**Files:**
- Modify: `src/protocols/aerodrome/types.ts`
- Modify: `src/protocols/aerodrome/mint.ts`
- Modify: `src/protocols/aerodrome/swap.ts`
- Create: `tests/unit/protocols/aerodrome/approval-receipts.test.ts`

**Diagnosis:** `mint.ts:30,36` (dois approves) e `swap.ts:53` (um approve) chamam
`ensureAllowance` com `await` e descartam o retorno. Simétrico à Task 2.1.

**Verification:** `npx vitest run tests/unit/protocols/aerodrome/`

**Prompt for subagent (Agent tool):**
```
Projeto: /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3
Lib TypeScript ESM (@fsa-tools/web3), viem + Vitest, tsconfig strict.

CONTEXTO — o que já mudou (feito por outra task, já commitado/aplicado)
`src/utils/erc20.ts` agora expõe:

    export type AllowanceResult = {
      approved: boolean;
      txHash?: Hash;                    // hash do approve final
      receipts: TransactionReceipt[];   // receipts das txs de approve, na ordem de envio; [] se nao aprovou
    };
    export async function ensureAllowance(ctx, params): Promise<AllowanceResult>

`receipts` pode ter 0, 1 ou 2 itens (2 quando houve reset-para-zero antes do approve).
Confirme lendo `src/utils/erc20.ts` antes de começar.

TAREFA
Propagar esses receipts até os results do protocolo AERODROME. Motivo: mintPosition e
swapExactInputSingle disparam approves ERC20 internamente; essas txs gastam gás e hoje o
consumidor nem sabe que existiram, então o custo de entrada dele subestima o gás.

ARQUIVO 1: src/protocols/aerodrome/types.ts
`PositionResult` e `SwapResult` ganham um campo NOVO, sempre presente:

    approvalReceipts: TransactionReceipt[];

- Sem `?`. Array vazio quando nenhum approve foi disparado.
- Importar `TransactionReceipt` de "viem" no `import type { Address, Hash } from "viem";`
  já existente na linha 1.
- Só `PositionResult` e `SwapResult`. NÃO tocar em `DecreaseResult`, `CollectResult`,
  `BurnResult` nem `QuoteResult` — essas operações não aprovam nada.
- Comente o campo no MESMO estilo do comentário que já acompanha `effectiveGasPrice`
  nesses tipos (pt-BR, sem acento, explicando o porquê e não o quê).

ARQUIVO 2: src/protocols/aerodrome/mint.ts
Linhas 30-40 fazem DOIS approves (token0 e token1) e descartam o retorno:

    await ensureAllowance(ctx, { token: params.token0, spender: params.npmAddress, ... });
    await ensureAllowance(ctx, { token: params.token1, spender: params.npmAddress, ... });

Capturar os dois retornos e concatenar os `receipts` NA ORDEM DE ENVIO (todos os do
token0, depois todos os do token1). Devolver o array no `return` final (linha ~99, hoje
`return { txHash, nftId, amount0, amount1, gasUsed: ..., effectiveGasPrice: ... };`)
como `approvalReceipts`.

ARQUIVO 3: src/protocols/aerodrome/swap.ts
Linha 53 faz UM approve (tokenIn) e descarta o retorno. Mesma coisa: capturar, devolver
`approvalReceipts` no return final (linha ~106).

RESTRIÇÕES
- NÃO tocar em src/protocols/uniswap-v3/** — é outra task rodando EM PARALELO com a sua,
  na mesma working tree. Editar lá causa conflito.
- NÃO tocar em src/protocols/aave/** (não usa ensureAllowance), nem em src/utils/erc20.ts.
- NÃO editar `tests/unit/protocols/mint-approve.test.ts` — ele importa OS DOIS protocolos
  e é o único ponto de colisão com a task paralela. Crie um arquivo de teste NOVO, em
  tests/unit/protocols/aerodrome/.
- NÃO alterar a lógica de approve, slippage, deadline, quote ou envio da tx principal.
  Só capturar e propagar os receipts.
- NÃO tocar em package.json.
- Mudança cirúrgica: sem refactor, sem renomeação, sem reorganizar imports.

TESTES: criar tests/unit/protocols/aerodrome/approval-receipts.test.ts
Espelhe o estilo de `tests/unit/protocols/aerodrome/swap.test.ts` (leia-o antes): mock de
`publicClient`/`walletClient` via `vi.fn` + `as unknown as ChainContext[...]`.

ATENÇÃO ao mock — os mocks existentes NÃO servem como estão:
- `writeContract` é usado TANTO pelo approve QUANTO pela tx principal, e os mocks atuais
  devolvem sempre o mesmo hash fixo. Faça-o devolver hashes DISTINTOS por chamada.
- `waitForTransactionReceipt` nos mocks atuais devolve sempre o MESMO objeto de receipt.
  Faça-o devolver um receipt identificável pelo hash recebido (ex.:
  `{ transactionHash: p.hash, gasUsed: ..., effectiveGasPrice: ..., logs: [...] }`),
  para o teste conseguir afirmar QUAIS receipts vieram em `approvalReceipts` e que eles
  são os dos APPROVES, não o da tx principal.
- O mint do Aerodrome parseia o log raw de IncreaseLiquidity pelo topic
  0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f (a
  AERODROME_NPM_ABI não tem eventos) — veja como `src/protocols/aerodrome/mint.ts` lê
  esse log e como `tests/unit/protocols/mint-approve.test.ts` monta um receipt com ele.

Cobrir:
- swapExactInputSingle com allowance 0 → `approvalReceipts` tem 1 item (o do approve),
  e ele NÃO é o receipt da tx de swap.
- swapExactInputSingle com allowance suficiente → `approvalReceipts` é `[]`.
- mintPosition com allowance 0 nos dois tokens → `approvalReceipts` tem 2 itens, na
  ordem [approve token0, approve token1].
- mintPosition com allowance suficiente nos dois tokens → `approvalReceipts` é `[]`.

RETORNO
Devolva: (a) o que mudou em cada arquivo, (b) quantos testes passam, (c) decisões
não-óbvias que você tomou.

Retorne quando `npx vitest run tests/unit/protocols/aerodrome/` sair com exit 0.

NÃO rode a suíte inteira (`npm test`) nem `npm run typecheck` para se validar: outra task
está editando src/protocols/uniswap-v3/** ao mesmo tempo, e você veria falhas que NÃO são
suas. Se algum teste fora de tests/unit/protocols/aerodrome/ falhar, NÃO conserte —
reporte e retorne.
```

### Cluster 3 — Docs

**Inter-cluster dependency:** depends on Cluster 2

#### Task 3.1: Entrada de CHANGELOG [haiku] +reviewer

**Files:**
- Modify: `CHANGELOG.md`

**Diagnosis:** o README não documenta os result types (grep por `SwapResult`/
`PositionResult`/`gasUsed` não retorna nada), então a documentação da mudança vive
inteira no CHANGELOG.

**Verification:** `grep -q "approvalReceipts" CHANGELOG.md`

**Prompt for subagent (Agent tool):**
```
Projeto: /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3
ARQUIVO: CHANGELOG.md (único arquivo a tocar)

TAREFA
Escrever a entrada de CHANGELOG da mudança que acabou de ser implementada.

O QUE FOI IMPLEMENTADO
`mintPosition` e `swapExactInputSingle` (Aerodrome e Uniswap V3) disparam approves ERC20
internamente via `ensureAllowance`. Essas txs gastam gás, mas os results só carregavam
dados da tx principal — o consumidor nem sabia que os approves existiram, e o custo de
entrada que ele calculava subestimava o gás, com viés sistemático e sempre para baixo.

Agora:
- `PositionResult` e `SwapResult` (ambos os protocolos) carregam
  `approvalReceipts: TransactionReceipt[]` — sempre presente, `[]` quando nenhum approve
  foi disparado.
- `AllowanceResult` (de `ensureAllowance`) carrega `receipts: TransactionReceipt[]`.
  O campo `txHash?` existente ficou intacto — mudança não-breaking.
- Bônus: `ensureAllowance` pode emitir DUAS txs — o reset-para-zero (quando a allowance
  corrente é > 0 mas < amount) e o approve final. O hash do reset não era exposto em
  lugar nenhum; agora o receipt dele vem no array, na ordem de envio.

POR QUE RECEIPTS E NÃO HASHES
`ensureAllowance` já dava `waitForTransactionReceipt` nas txs e jogava os receipts fora.
Devolvê-los custa ZERO RPC extra e entrega `gasUsed`, `effectiveGasPrice` e, na Base/
OP-stack, `l1Fee`. Devolver só os hashes forçaria o consumidor a rebuscar cada receipt —
exatamente o custo que a 3.8.0 acabou de eliminar para a tx principal (`effectiveGasPrice`).

RESSALVA A DOCUMENTAR
O tipo `TransactionReceipt` do viem NÃO declara `l1Fee` — o campo chega em runtime pelo
chain formatter da Base. Quem precisar dele na OP-stack vai precisar de um cast. Foi uma
decisão consciente: tipar o receipt pela chain vazaria generics para toda a API pública
da lib.

FORMATO
- Nova seção no topo, abaixo de `# Changelog`, como `## 3.9.0 — 2026-07-13`.
- Siga EXATAMENTE o estilo das entradas 3.7.0 e 3.8.0 que já estão no arquivo: leia-as
  antes. Elas usam `### Added`, prosa em pt-BR explicando o QUE mudou, e um parágrafo
  em negrito **Porquê:** com o raciocínio técnico. Reproduza esse tom.
- Mencione a ressalva do `l1Fee`.

RESTRIÇÕES
- NÃO tocar em package.json — o bump de versão é do /done.
- NÃO tocar em nenhum outro arquivo.
- NÃO alterar as entradas de versões anteriores do CHANGELOG.

RETORNO
Devolva o texto da entrada que você escreveu.
Retorne quando `grep -q "approvalReceipts" CHANGELOG.md` sair com exit 0.
```

## Launch order (DAG resolved)

### Phase 0 — parallel

- Cluster 1 / Task 1.1

**Fan-out Phase 0: 1 parallel task**

### Phase 1 — after Phase 0 completes

- Cluster 2 / Task 2.1
- Cluster 2 / Task 2.2

**Fan-out Phase 1: 2 parallel tasks**

### Phase 2 — after Phase 1 completes

- Cluster 3 / Task 3.1 (+reviewer)
