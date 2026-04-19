# v1.8 Completion — Design Spec

**Data:** 2026-04-18
**Escopo:** Tasks T4, T5, T2, T1, T7, T6 do ROADMAP v1.8. T3 (Aave revert 51) excluído — spec própria.
**Out of scope:** v2.0 (breaking changes), T3, qualquer mudança em código de produção além do explicitamente listado.

---

## Ordem de execução

```
T4 → T5 → T2 → T1 → T7 → T6
```

T4/T5/T2 tocam arquivos de smoke adjacentes — serial obrigatório.
T1/T7/T6 são independentes após T2 — podem rodar em qualquer ordem.

---

## T4 — Remover `as any` residual

**Arquivos:** `tests/smoke/uniswap-v3.smoke.test.ts`, `tests/smoke/aerodrome.smoke.test.ts`

Substituir cada ocorrência de `as any` por tipo correto:
- Endereços: `as \`0x${string}\`` ou inferência via tipo de `SmokeChainConfig`
- Outros casts: usar tipo exato retornado por viem/contrato

Gate: `pnpm tsc --noEmit` deve passar sem erros.
Sem tocar código de produção (`src/`).

---

## T5 — `ADDRESSES` limpo

**Arquivos:** `src/addresses.ts` (ou equivalente), `tests/smoke/_helpers.ts`

**Problema:** `wethUsdcPool` em Sepolia (11155111) e Amoy (80002) aponta para o próprio WETH (placeholder inválido).

**Abordagem híbrida:**
1. Tornar `wethUsdcPool` opcional no tipo: `wethUsdcPool?: \`0x${string}\``
2. Resolver pool real em Sepolia via Uniswap V3 Factory `getPool(WETH, USDC, fee)` — fee tiers 500, 3000, 10000
3. Amoy: investigar se Uniswap V3 Factory está deployada. Se sim, resolver. Se não, omitir.
4. Adicionar `baseSepolia` (chainId 84532) em `SMOKE_CHAINS` com endereços WETH/USDC + `aerodromeNpm` (ver T2)

Consumers de `wethUsdcPool` nos arquivos de smoke (`_helpers.ts`, `uniswap-v3.smoke.test.ts`) devem ter guard (`?.`) — breaking change defensivo, não silencioso. Código de produção em `src/` não referencia esse campo (é config de teste apenas).

---

## T2 — Smoke tests reais Uniswap V3 + Aerodrome

**Contexto:** Hoje `uniswap-v3.smoke` e `aerodrome.smoke` skipam por `weth=0` ou pool placeholder. Com T5 concluído, habilitá-los.

### Uniswap V3 — Sepolia
- Gate: `cfg.protocols.uniswapV3Npm && cfg.addresses?.wethUsdcPool`
- Funding disponível: 0.59 ETH + 80 USDC Sepolia (carteira smoke)
- Wrap ETH → WETH se necessário antes do smoke

### Aerodrome — Base Sepolia (chainId 84532)
- Verificar deployment de Aerodrome NonfungiblePositionManager em Base Sepolia e anotar endereço em `SMOKE_CHAINS.baseSepolia.protocols.aerodromeNpm`
- Gate: `cfg.protocols.aerodromeNpm && cfg.addresses?.wethUsdcPool`
- Funding disponível: 0.0002 ETH Base Sepolia (suficiente em L2, gas barato)
- **Pré-requisito:** USDC em Base Sepolia = 0. Obter via faucet Base Sepolia antes de rodar (https://faucet.circle.com/ ou Alchemy Base Sepolia faucet). Par alvo: WETH/USDC.
- Se deployment de Aerodrome não existir em Base Sepolia, smoke skipa por design e é documentado no ROADMAP.

### Aerodrome — Sepolia/Amoy
- Sem deployment. Smoke permanece skipando por design.
- Adicionar comentário: `// Aerodrome não tem deployment em Sepolia/Amoy — smoke requer Base Sepolia`
- Documentar no ROADMAP.

---

## T1 — Ticks canônicos

**Arquivo:** `src/math/ticks.ts`

**Problema:** `getSqrtRatioAtTick` usa float — `MIN_TICK`/`MAX_TICK` divergem dos canônicos do Uniswap V3, gerando off-by-one em preço extremo.

**Solução:** Reescrever em bigint bit-a-bit seguindo `TickMath.getSqrtRatioAtTick` de `v3-core/contracts/libraries/TickMath.sol`.

Constantes canônicas:
- `MIN_TICK = -887272`
- `MAX_TICK = 887272`
- `MIN_SQRT_RATIO = 4295128739n`
- `MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n`

**Testes unitários obrigatórios:**
- `getSqrtRatioAtTick(0)` → `79228162514264337593543950336n` (Q96 de 1.0)
- `getSqrtRatioAtTick(MIN_TICK)` → `MIN_SQRT_RATIO`
- `getSqrtRatioAtTick(MAX_TICK)` → `MAX_SQRT_RATIO`
- Comparar subset de ticks com tabela de referência do Uniswap SDK

Gate: smoke Uniswap V3 de T2 deve continuar verde após o refactor.

---

## T7 — SECURITY known issues

**Arquivos:** código de produção (`src/`) — mudanças cirúrgicas.

### R-03 — Retry sem backoff
Funções RPC que lançam timeout ou 5xx devem usar exponential backoff com jitter:
- Base: 1s, max: 30s, tentativas: 3
- Implementar wrapper `withRetry(fn, { base, max, attempts })` em `src/utils/retry.ts`
- Aplicar nas chamadas críticas de leitura on-chain (readContract, publicClient calls)

### T-04 — Slippage sem upper bound
Entry points de swap/provide liquidity que aceitam `slippageBps` devem validar:
```ts
if (slippageBps > 5000) throw new Error("slippageBps exceeds maximum (5000 = 50%)")
```
Posição: validação no entry point, antes de qualquer cálculo.

### L-03 — Sem deadline default
Funções de escrita (supply, swap, mint position) devem injetar deadline quando não fornecido:
```ts
const deadline = params.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 1200)
```
Padrão: `now + 1200s` (20 minutos, alinhado com Uniswap default).

---

## T6 — CI publish automático

**Plataforma:** GitLab CI

**Problema:** Stage `publish` existe no pipeline de tag mas falha por `VERDACCIO_TOKEN` ausente.

**Ação:** Adicionar `VERDACCIO_TOKEN` como variável protegida e masked no GitLab CI/CD Settings do projeto. Sem mudança de código — só configuração de infra.

Validação: criar tag de teste `v1.8.0-rc.1` e confirmar que o stage `publish` passa.

---

## Definition of Done

- [ ] `tsc --noEmit` sem erros após cada task
- [ ] Nenhum `as any` em arquivos de smoke
- [ ] `wethUsdcPool` opcional com pool real onde existe
- [ ] Smoke Uniswap V3 Sepolia: `1 passed`
- [ ] Smoke Aerodrome Base Sepolia: `1 passed` (ou documentado por que skipa)
- [ ] `getSqrtRatioAtTick` em bigint — testes unitários passando com valores de referência
- [ ] `withRetry`, slippage upper bound, deadline default implementados e cobertos por teste
- [ ] CI publish verde em tag de teste
- [ ] CHANGELOG e ROADMAP atualizados
