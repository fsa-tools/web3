# @fsa/web3 — Reconstrução v1.7.1

**Data:** 2026-04-18
**Autor:** brainstorming (Claude + fabio)
**Status:** aprovado — pronto para writing-plans
**Repo destino:** `git@gitlab.com:fsa-portfolio/fsa-web3.git` (zero km)

---

## Contexto

O source tree de `@fsa/web3` foi perdido durante um `mv` de `~/dev/projetos/lib` para `~/dev/projetos/trading/libs`. O diretório atual contém apenas `dist/` (compilado publicado como v1.7.0 no Verdaccio `http://avell.local:4873`). Não havia repositório git remoto. Recovery via Time Machine falhou (`POSIXError Operation not permitted`), Trash vazia, editores locais sem history. Yarn cache guarda apenas dist de versões antigas (1.3.0, 1.4.0).

Três consumidores dependem de `@fsa/web3@^1.7.0`: `vfat-monitor`, `claw-yield`, `defigenius`. Todos rodam em dry-run / Fase 3. Auditoria DeFi identificou 3 findings MEDIUM pendentes que tocam esta lib (R-03 confirmations, T-04 approve(0) race, L-03 IL estimation) — **fora do escopo desta spec**, endereçados em v1.8.0.

## Objetivo

Restaurar source tree funcionalmente idêntico a v1.7.0, publicar como v1.7.1, com:
1. Paridade funcional verbatim (zero mudança de comportamento)
2. Repositório git versionado
3. Cobertura smoke máxima em testnet real (Arbitrum Sepolia, Base Sepolia, Polygon Amoy)
4. Testes unit em módulos puros determinísticos
5. CI/CD no GitLab com publish automatizado ao Verdaccio

## Não-objetivos

- Aplicar fixes R-03, T-04, L-03 (vão em spec separada → v1.8.0)
- Breaking changes de API
- Adicionar protocolos/chains não presentes em 1.7.0
- Refactor estrutural

## Inventário de v1.7.0 (origem da reconstrução)

37 arquivos em 6 módulos. Exports definidos em `package.json`:

```
.             → dist/index.js
./aave        → dist/src/protocols/aave/index.js
./aerodrome   → dist/src/protocols/aerodrome/index.js
./uniswap-v3  → dist/src/protocols/uniswap-v3/index.js
./utils       → dist/src/utils/index.js
./math        → dist/src/math/index.js
./abis        → dist/src/abis/index.js
./constants   → dist/src/constants/index.js
```

Dependências runtime: `viem ^2.0.0`.
Dev: `typescript ^5.7.0`, `vitest ^3.0.0`, `@viem/anvil ^0.0.10`, `@types/node ^25.5.0`.

### Árvore de arquivos a reconstruir

```
src/
├── index.ts
├── abis/         aave-pool, aerodrome-npm, erc20, npm, pool, index
├── constants/    addresses, chains, gas, index
├── math/         liquidity, slippage, ticks, index
├── protocols/
│   ├── aave/        position, supply, withdraw, types, index
│   ├── aerodrome/   burn, collect, decrease, mint, types, index
│   └── uniswap-v3/  burn, collect, decrease, mint, types, index
└── utils/        address, client, decimals, erc20, gas, pool, position, index
```

## Arquitetura

Preservada 1:1 de v1.7.0. Sem mudanças de módulos, exports, ou assinaturas.

## Processo de reconstrução (por arquivo)

1. Ler `dist/src/<path>.js` (implementação) + `.d.ts` (assinaturas) + `.d.ts.map` (nomes de parâmetros originais)
2. Mesclar em arquivo `.ts`:
   - Assinaturas e tipos exportados → do `.d.ts`
   - Corpo de funções → do `.js`, convertido para TS estrito
   - Imports com extensão explícita `.js` (NodeNext ESM)
3. `tsc --noEmit` por módulo antes de avançar ao próximo
4. Preservar ordem de exports conforme `dist/src/<modulo>/index.js`

**Perda aceita:** JSDoc, comentários de rationale, formatação. Nomes de símbolos e shape de API são preservados via `.d.ts`.

## Testes

### Unit (sem rede)

Cobre módulos puros com valores canônicos conhecidos:

- `math/ticks` — `getSqrtRatioAtTick` em tick 0, ±100, ±60, ±887272 (MIN/MAX). Valores-alvo: tabela Uniswap V3 reference
- `math/liquidity` — `getAmountsForLiquidity` com ranges canônicos
- `math/slippage` — aplicação de bps (50, 100, 500) em amounts fixos
- `utils/address` — `validateAddress` com endereços válidos/inválidos; checksum EIP-55
- `utils/decimals` — `parseUnits`/`formatUnits` com 6 (USDC), 8 (WBTC), 18 (WETH)

Config: `vitest.config.ts`, default run em `pnpm test` / `npm test`.

### Smoke (testnet real)

Cobertura máxima. Requer `.env` com private keys providas pelo usuário no momento da execução:

```
SMOKE_PK_ARBITRUM=0x...
SMOKE_PK_BASE=0x...
SMOKE_PK_POLYGON=0x...
ARBITRUM_SEPOLIA_RPC=https://...
BASE_SEPOLIA_RPC=https://...
POLYGON_AMOY_RPC=https://...
```

| Chain | Protocolos | Cenário smoke |
|---|---|---|
| Arbitrum Sepolia | Aave V3, Uniswap V3, utils | `supply → withdraw`, `mint → decrease(50%) → collect → burn`, `ensureAllowance`, `getBalance`, `withGasGuard`, `pool.slot0` |
| Base Sepolia | Aerodrome, Uniswap V3, utils | idem aerodrome + uniswap-v3 |
| Polygon Amoy | Aave V3, Uniswap V3, utils | idem arbitrum |

Cada teste:
1. Lê PK do `.env` — skip com `test.skip` se ausente
2. Valida saldo mínimo (native + token) — skip se insuficiente
3. Executa operação pequena (~1 unidade de token faucet)
4. Assert receipt `status: "success"` e delta de saldos esperado
5. Cleanup best-effort (collect pendente, decrease total) — não falha teste se cleanup falhar

Tag vitest: `@smoke`. Config isolada: `vitest.smoke.config.ts`. Comando: `npm run test:smoke`.

**Não roda no CI** — smoke só executa manualmente antes de publish, com supervisão humana (consome gas real testnet).

## CI/CD — GitLab

Pipeline `.gitlab-ci.yml`:

```
stages: [install, check, build, publish]

install:     npm ci
check:       npm run typecheck && npm run test       (unit only)
build:       npm run build                           (tsc)
publish:     npm publish                             (só em tag v*.*.*)
```

Variáveis protegidas:
- `VERDACCIO_TOKEN` — auth no registry

Branch protegida: `main`. MR obrigatório após commit inicial.

## Versionamento & Release

- Commit inicial: `chore: initial reconstruction from dist v1.7.0` → tag `v1.7.1`
- CHANGELOG: 1.7.1 — "Rebuild from compiled dist after source loss; no functional change"
- README documenta processo de recovery e aponta para esta spec
- Publish Verdaccio após smoke testnet passar nas 3 chains

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Reconstrução diverge em edge case não testado | Smoke em 3 testnets cobre caminhos reais de protocolo |
| Testnet faucet seco em uma chain | Pular smoke daquela chain; bloquear publish até resolver |
| Consumer quebra com 1.7.1 | Reverter publish (Verdaccio permite unpublish); consumer fica em 1.7.0 cached |
| Private keys vazam em logs CI | Smoke não roda em CI; `.env` gitignored; `.env.example` sem valores |
| Type erasure do .d.ts perde info privada | Tipos internos reconstruídos a partir do uso no `.js`; validado por `tsc --noEmit` |

## Segurança

- `.gitignore` explícito: `.env`, `.env.*`, `node_modules/`, `dist/`, `coverage/`, `.vitest-cache/`
- `.npmrc` commit'ado sem token (`_authToken=${VERDACCIO_TOKEN}`)
- `SECURITY.md` lista findings R-03, T-04, L-03 como known-issues com link para spec v1.8.0
- Nenhum PK hardcoded em testes — sempre via `.env` local

## Entregáveis

1. Repositório em `git@gitlab.com:fsa-portfolio/fsa-web3.git` com estrutura acima
2. `src/` reconstruído, `tsc --noEmit` limpo
3. Unit tests passando (`math`, `utils` puros)
4. Smoke tests implementados (execução manual pelo usuário com PKs)
5. `.gitlab-ci.yml` com pipeline completa
6. `v1.7.1` publicado no Verdaccio após smoke OK
7. Consumidores (vfat-monitor, claw-yield, defigenius) inalterados — ainda em `^1.7.0` resolve para 1.7.1

## Sequenciamento (alto nível, detalhado em writing-plans)

1. Bootstrap repo + scaffold (package.json, tsconfig, configs, .gitignore, .gitlab-ci.yml)
2. Reconstruir `abis/`, `constants/` (JSON/const puros, risco zero)
3. Reconstruir `math/` + unit tests
4. Reconstruir `utils/` + unit tests (address, decimals)
5. Reconstruir `protocols/aave/`, `aerodrome/`, `uniswap-v3/`
6. Smoke tests (implementação)
7. **PAUSA** — usuário injeta PKs no `.env`
8. Rodar smoke nas 3 chains
9. Publish v1.7.1 → tag → push GitLab
10. Atualizar `docs/maturity.md` nos consumidores (remover alerta de perda)
