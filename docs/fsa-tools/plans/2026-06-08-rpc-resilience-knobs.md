# Plan — RPC resilience knobs no createChainContext (issue #3)

## Metadata

- **Generated:** 2026-06-08
- **Worktree:** recommended
- **Issue:** fsa-tools/web3#3 (`enhancement`)

## Context

- Projeto: `@fsa-tools/web3` (lib TS publicada na Verdaccio), raiz `~/dev/projetos/trading/libs/fsa-web3`.
- ESM puro, `module: NodeNext` → imports relativos exigem extensão `.js`. Único dep: `viem@2.50.4`.
- Alvo: `src/context.ts` (`createChainContext` / `CreateChainContextParams`). Utils pequenos e tipados vivem em `src/utils/*` (ex.: `retry.ts`); testes unit em `tests/unit/` com vitest, descrições em pt-BR.

## Baseline (current state)

```bash
# transport atual: http() cru, sem timeout/cooldown/p-limit explícitos
sed -n '64,67p' src/context.ts
# => fallback(params.rpcUrls.map((url) => http(url)), { rank: true, retryCount: 1 })
npm run typecheck && npm run test   # suíte verde no estado atual
```

## Objective

Estender `CreateChainContextParams` com um campo opcional `rpc?: { timeoutMs?, retryCount?, cooldownMs?, maxConcurrency? }`, retrocompatível: omitir `rpc` mantém o transport idêntico ao de hoje. `timeout`/`retryCount` são passados pro `http()` interno; `cooldownMs` pula um provider 429'd pela janela; `maxConcurrency` limita eth_calls concorrentes por chain via semáforo in-house (sem dep nova).

## Definition of Done (global)

```bash
npm run typecheck && npm run build && npm run test
```

**Expected output:** vitest reporta todos os arquivos de teste com `passed` e **zero** `failed`; `tsc` e `tsc (build)` sem erros (exit 0).

## Policy (invariant)

- **Sem dep nova.** O semáforo é in-house; `package.json` continua com `viem` como único dependency. Não adicionar `p-limit` nem nada.
- **Retrocompat absoluta.** Omitir `rpc` (ou qualquer subcampo) deve produzir transport idêntico ao atual. Os 6 testes existentes em `tests/unit/context.test.ts` continuam passando sem alteração de comportamento.
- **TS estrito.** `strict: true`. Proibido `any` — use `unknown` + type guard ou tipos do viem (`Transport`, `EIP1193RequestFn`). Imports relativos com extensão `.js`.
- **Imutabilidade nas fronteiras.** Não mutar `params` nem arrays recebidos de fora. Estado mutável interno (contador do semáforo, `cooldownUntil` em closure) é permitido.
- **Cap de funções ≤50 linhas**, early-returns, sem `console.log`, sem código comentado.
- **Não fechar a issue.** Escopo é só o código + testes; release/finalização é etapa do operador (fora do DAG).

## Dependency justification

- **Task 1.2 blockedBy Task 1.1:** 1.2 importa `withCooldown`, `withConcurrencyLimit` (e o tipo de opções) de `src/utils/rpc-pool.ts`, que **só existe após 1.1**. Sem o módulo, o import não resolve, `tsc` quebra e a composição do transport em `context.ts` não pode ser escrita. Handoff de artefato real — não hábito sequencial.

## Clusters

### Cluster 1 — Resiliência RPC no createChainContext

**Inter-cluster dependency:** none

#### Task 1.1: Implementar wrappers de transport (semáforo + cooldown-429 + cap) [sonnet] +reviewer

**Files:**
- Create: `src/utils/rpc-pool.ts`
- Create: `tests/unit/utils/rpc-pool.test.ts`

**Diagnosis:** Um `viem` `Transport` é `(config) => { config, request, value }`. Para adicionar resiliência sem reescrever `fallback`, criamos higher-order transports que chamam o transport interno e substituem `request`: (a) cooldown-429 por provider — envolve cada `http(url)` antes do `fallback`, então um 429 faz aquele provider lançar imediatamente e o `fallback` migra; (b) cap de concorrência por chain — envolve o resultado do `fallback` com um único semáforo. `HttpRequestError.status === 429` (viem) identifica o rate-limit.

**Verification:** `npm run typecheck && npx vitest run tests/unit/utils/rpc-pool.test.ts`

**Prompt for subagent (Agent tool):**
```
Projeto: ~/dev/projetos/trading/libs/fsa-web3 (lib TS ESM, module NodeNext, viem@2.50.4, único dep é viem). cd nesse diretório.

TAREFA: criar um módulo INTERNO de wrappers de transport viem para resiliência RPC, com testes unit (TDD: escreva os testes primeiro, depois a implementação).

CRIAR src/utils/rpc-pool.ts exportando exatamente três funções:

1) createSemaphore(max: number): <T>(fn: () => Promise<T>) => Promise<T>
   - Semáforo in-house (sem dep externa). Limita a `max` execuções concorrentes de `fn`.
   - Quando `active >= max`, enfileira; ao liberar um slot, puxa o próximo da fila.
   - Estado mutável interno (contador `active`, array `queue`) é permitido. Não mutar nada externo.
   - Implementação de referência:
       export function createSemaphore(max: number) {
         let active = 0;
         const queue: Array<() => void> = [];
         const next = () => {
           if (active >= max || queue.length === 0) return;
           active++;
           const run = queue.shift()!;
           run();
         };
         return function acquire<T>(fn: () => Promise<T>): Promise<T> {
           return new Promise<T>((resolve, reject) => {
             queue.push(() => {
               fn().then(resolve, reject).finally(() => { active--; next(); });
             });
             next();
           });
         };
       }

2) withCooldown(transport: Transport, cooldownMs: number): Transport
   - Envolve UM transport (um provider). Mantém `cooldownUntil` em closure POR INSTÂNCIA retornada do transport
     (declare `cooldownUntil` dentro da função `(config) => {...}`, após chamar o inner, para que cada client tenha seu estado).
   - No request: se `Date.now() < cooldownUntil` → lance `new Error("provider in cooldown")` SEM chamar o inner
     (isso faz o fallback do viem migrar pro próximo provider).
   - Senão chame `inner.request(args)`; no catch, se for 429 → `cooldownUntil = Date.now() + cooldownMs`; relance sempre.
   - Detecção de 429: helper `is429(err: unknown): boolean` que percorre a cadeia de `cause` procurando um objeto com
     `status === 429` (o `HttpRequestError` do viem expõe `.status?: number`). Algo como:
       function is429(err: unknown): boolean {
         let cur: unknown = err;
         for (let i = 0; i < 5 && cur; i++) {
           if (typeof cur === "object" && cur !== null && (cur as { status?: number }).status === 429) return true;
           cur = (cur as { cause?: unknown }).cause;
         }
         return false;
       }
   - Forma do wrapper:
       export function withCooldown(transport: Transport, cooldownMs: number): Transport {
         return (config) => {
           const inner = transport(config);
           let cooldownUntil = 0;
           const request = (async (args) => {
             if (Date.now() < cooldownUntil) throw new Error("provider in cooldown");
             try { return await inner.request(args); }
             catch (err) { if (is429(err)) cooldownUntil = Date.now() + cooldownMs; throw err; }
           }) as typeof inner.request;
           return { ...inner, request };
         };
       }

3) withConcurrencyLimit(transport: Transport, maxConcurrency: number): Transport
   - Cap de concorrência POR CHAIN: crie UM semáforo (createSemaphore(maxConcurrency)) UMA vez, fora da função
     `(config) => {...}`, e compartilhe-o entre todos os requests do transport retornado.
       export function withConcurrencyLimit(transport: Transport, maxConcurrency: number): Transport {
         const limit = createSemaphore(maxConcurrency);
         return (config) => {
           const inner = transport(config);
           const request = ((args) => limit(() => inner.request(args))) as typeof inner.request;
           return { ...inner, request };
         };
       }

TIPOS: importe `Transport` e `EIP1193RequestFn` de "viem" (`import type { Transport, EIP1193RequestFn } from "viem"`).
Proibido `any`. As coerções `as typeof inner.request` são aceitáveis (preservam a assinatura EIP-1193 sobrecarregada do viem) — não use `as any`.

CRIAR tests/unit/utils/rpc-pool.test.ts (vitest, estilo dos testes existentes — veja tests/unit/utils/retry.test.ts: import com extensão .js, describe/it, vi.fn). Cobrir:
  - createSemaphore: lançar N>max tarefas que resolvem via deferred manual; assert que no máximo `max` rodam concorrentes
    (ex.: contador de "em execução" nunca passa de `max`) e que todas concluem.
  - withCooldown: monte um transport mock mínimo:
      const mkTransport = (requestFn): Transport => () => ({ config: { key:"mock", name:"mock", request: requestFn, type:"mock" }, request: requestFn, value: undefined });
    Use `vi.useFakeTimers()`. Cenário: request lança erro com `{ status: 429 }` → próxima chamada dentro de cooldownMs
    lança "provider in cooldown" SEM invocar o inner (assert via spy call count); após `vi.advanceTimersByTime(cooldownMs)`
    o inner é chamado de novo. Restaure com vi.useRealTimers() no fim.
  - withCooldown: erro NÃO-429 (ex.: `new Error("boom")`) NÃO ativa cooldown — a próxima chamada invoca o inner.
  - withConcurrencyLimit: mesma ideia do semáforo, mas através do transport — assert que o inner.request nunca tem mais
    de `maxConcurrency` chamadas in-flight.

NÃO TOQUE: src/context.ts, package.json, nenhum outro arquivo. Não adicione dependências. Não exporte nada em src/utils/index.ts (módulo é interno, consumido só por context.ts).

VERIFICAÇÃO: rode `npm run typecheck && npx vitest run tests/unit/utils/rpc-pool.test.ts`. Retorne quando sair com exit 0.
RETORNE: resumo de 3-5 linhas — arquivos criados, assinaturas exportadas, nº de testes e estado (passed), e qualquer decisão de tipagem não óbvia.
```

#### Task 1.2: Estender CreateChainContextParams e compor wrappers [sonnet]

**Intra-cluster dependency:** 1.1

**Files:**
- Modify: `src/context.ts`
- Modify: `tests/unit/context.test.ts`

**Diagnosis:** O transport hoje é `fallback(rpcUrls.map(url => http(url)), { rank:true, retryCount:1 })`. Adicionamos `rpc?` aos params; quando presente, `http(url, { timeout, retryCount })` recebe o passthrough, cada provider é opcionalmente envolto por `withCooldown`, e o `fallback` inteiro é opcionalmente envolto por `withConcurrencyLimit`. Quando `rpc` é omitido, o caminho é byte-a-byte o atual (`http(url)` sem segundo argumento).

**Verification:** `npm run typecheck && npm run build && npx vitest run tests/unit/context.test.ts`

**Prompt for subagent (Agent tool):**
```
Projeto: ~/dev/projetos/trading/libs/fsa-web3 (lib TS ESM NodeNext, viem@2.50.4). cd nesse diretório.
PRÉ-REQUISITO já pronto: src/utils/rpc-pool.ts exporta `withCooldown(transport, cooldownMs): Transport` e `withConcurrencyLimit(transport, maxConcurrency): Transport`. Leia esse arquivo antes de começar para confirmar as assinaturas.

TAREFA: estender src/context.ts com knobs de resiliência RPC opcionais e retrocompatíveis, e atualizar os testes.

1) Em src/context.ts, adicione um tipo e o campo nos params:
     export type RpcOptions = {
       timeoutMs?: number;      // timeout por chamada no http() interno
       retryCount?: number;     // retries do http() interno (default viem = 3)
       cooldownMs?: number;     // ao 429, pula o provider por N ms
       maxConcurrency?: number; // cap de eth_calls concorrentes por chain
     };
   e em CreateChainContextParams adicione `rpc?: RpcOptions;` (mantenha os campos existentes na mesma ordem).

2) Substitua APENAS o bloco de construção do transport (linhas ~64-67, o `const transport = fallback(...)`) por:
     const rpc = params.rpc;
     const httpOptions =
       rpc && (rpc.timeoutMs !== undefined || rpc.retryCount !== undefined)
         ? { timeout: rpc.timeoutMs, retryCount: rpc.retryCount }
         : undefined;
     const providers = params.rpcUrls.map((url) => {
       const base = httpOptions ? http(url, httpOptions) : http(url);
       return rpc?.cooldownMs ? withCooldown(base, rpc.cooldownMs) : base;
     });
     const ranked = fallback(providers, { rank: true, retryCount: 1 });
     const transport = rpc?.maxConcurrency
       ? withConcurrencyLimit(ranked, rpc.maxConcurrency)
       : ranked;
   Importe no topo: `import { withConcurrencyLimit, withCooldown } from "./utils/rpc-pool.js";` (extensão .js obrigatória).
   RETROCOMPAT: quando `params.rpc` é undefined, `httpOptions` é undefined → `http(url)` sem 2º arg, sem withCooldown,
   sem withConcurrencyLimit → transport idêntico ao atual. Não altere `{ rank: true, retryCount: 1 }`.

3) Em tests/unit/context.test.ts, MANTENHA os 6 testes existentes intactos (eles provam retrocompat) e adicione:
   - Um teste que cria o contexto com `rpc: { timeoutMs: 5000, retryCount: 0, cooldownMs: 30000, maxConcurrency: 4 }`
     e assert que `ctx.publicClient` é definido e não lança.
   - Um teste de PASSTHROUGH usando partial mock do viem para spiar `http`:
       import { http } from "viem"; // já usado
       // No topo do arquivo:
       vi.mock("viem", async (importOriginal) => {
         const actual = await importOriginal<typeof import("viem")>();
         return { ...actual, http: vi.fn(actual.http) };
       });
     No teste: limpe mocks, chame createChainContext com `rpc: { timeoutMs: 1234, retryCount: 2 }` e assert que
     `http` foi chamado com 2º argumento `{ timeout: 1234, retryCount: 2 }`. Em outro teste, sem `rpc`, assert que
     `http` foi chamado SEM 2º argumento (ou com `undefined`). Use `expect(vi.mocked(http)).toHaveBeenCalledWith(...)`.
     (Esse passthrough é o proxy testável do "tail bounded": o enforcement do timeout é responsabilidade do viem;
     nós só garantimos que o knob chega no http().)

NÃO TOQUE: src/utils/rpc-pool.ts (já pronto), package.json, outros arquivos. Proibido `any`. Não exporte RpcOptions em
nenhum index — o subpath `./context` já reexporta o módulo inteiro via exports do package.json.

VERIFICAÇÃO: rode `npm run typecheck && npm run build && npx vitest run tests/unit/context.test.ts`. Retorne quando exit 0.
RETORNE: resumo — diff conceitual do bloco de transport, testes adicionados e estado (passed), confirmação de que os 6 testes originais seguem verdes.
```

## Launch order (DAG resolved)

### Phase 0 — parallel

- Cluster 1 / Task 1.1

**Fan-out Phase 0: 1 parallel task**

### Phase 1 — after Phase 0 completes

- Cluster 1 / Task 1.2 (+reviewer roda sobre 1.1 antes de 1.2 integrar)

## Release (operador — fora do DAG de subagentes)

Após a DoD global passar e verificação manual: bump minor `3.4.0 → 3.5.0`, CHANGELOG, publish Verdaccio e finalização da issue (commit com `ref #3`, comment de handoff, label `needs-review`, **sem fechar**) — via `/done`/`/publish`. Não dispatchado por subagente porque push a registry é outward-facing.

## Notas de honestidade

- O critério "provider mock que hanga → erro dentro do budget, não 120s+" **não** é testado end-to-end (exigiria servidor HTTP mock e seria flaky). O proxy unit é a asserção de passthrough (o `timeout` chega no `http()`); o enforcement em si é do viem, battle-tested. Limitação assumida no plano.
- `maxConcurrency` é **por chain** (1 semáforo no client), conforme o critério de aceite da issue — diverge do `p-limit por provider` canônico do defi-agent (bot.md). Decisão do operador nesta sessão.
