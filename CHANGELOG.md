# Changelog

## [2.0.0] — TBD

### Breaking Changes
- `createClients` removido — use `createChainContext` de `@fsa/web3/context`
- Todas as funções de protocolo e utils recebem `(ctx: ChainContext, params)` em vez de flat object
- Tipos renomeados: `MintParams` → `MintOperationParams`, `SupplyParams` → `SupplyOperationParams`, etc.
- `_resetCache` removido — cache agora é `ctx.decimalsCache` (Map injetável)

### Added
- `ChainContext` — contrato central injetável (import from `@fsa/web3/context`)
- `createChainContext(params)` — cria contexto com transport fallback sempre ativo
- Erros tipados: `ChainNotSupportedError`, `ProtocolNotSupportedError`, `ReserveInactiveError`, `InsufficientAllowanceError`, `SlippageExceededError`, `AddressValidationError`, `ReceiptEventNotFoundError`
- `./errors` e `./context` em package.json exports

### Migration Guide
> Veja README.md — seção "Migrating from v1.x to v2.0"

## [1.8.1] — 2026-04-20

### Fixed
- `waitForTransactionReceipt` em todos os entry points (uniswap-v3, aerodrome, aave) agora usa `confirmations: 2` — R-03
- `ensureAllowance` emite `approve(0)` e aguarda receipt antes de `approve(MAX_UINT256)` quando `currentAllowance > 0` — previne revert em tokens USDT-like — T-04

## [1.8.0] — 2026-04-19

### Added
- `src/utils/retry.ts`: `withRetry<T>` com exponential backoff + full jitter (base 1s, max 30s, 3 tentativas) — R-03
- `MIN_SQRT_RATIO` e `MAX_SQRT_RATIO` exportados de `src/math/ticks.ts`

### Changed
- `getSqrtRatioAtTick` reescrito em bigint (port de `TickMath.sol` do Uniswap v3-core) — elimina divergência float em ticks extremos. `MIN_TICK` agora retorna `4295128739n` (canônico), `MAX_TICK` retorna `1461446703485210103287273052203988822378723970342n` — T1
- `slippageBps > 5000` lança erro em `uniswap-v3/mint`, `aerodrome/mint` e `uniswap-v3/decrease` (reduzido de 10000 para 50% máximo) — T-04
- `publicClient.simulateContract` em `uniswap-v3/decrease` envolto com `withRetry` para tolerância a falhas RPC transientes
- `wethUsdcPool` em `ChainAddresses` agora opcional (`Address | undefined`) — Sepolia e Amoy não têm pool WETH/USDC válido
- Sepolia `wethUsdcPool` resolvido via Uniswap V3 Factory: `0x4d8cad269d06fd610334ccda8384857c2d9327d1` (fee 500)
- Smoke Uniswap V3: gate adicionado em `chainAddrs?.wethUsdcPool` + wrap ETH→WETH automático quando saldo insuficiente
- Smoke Aerodrome: tipagem correta (`mintPosition`, `decreaseLiquidity`, `collectFees`, `burnPosition`; `nftId`; `slot0` + `positions()` para liquidity)
- Aerodrome Finance não tem deployment em Base Sepolia (verificado 2026-04-19 via `eth_getCode`) — smoke skipa por design

## [Unreleased]

### Changed
- `SmokeChainConfig` ganhou campo opcional `aaveReserves?: { weth?; usdc? }` para desacoplar tokens listados no Aave Pool V3 de `faucetTokens` (que atende Uniswap/Aerodrome). `aave.smoke` agora usa `aaveReserves.usdc` como `asset` e no gate `canRun` — mais explícito sobre a intenção. Mensagem de warn em saldo insuficiente orienta o uso do `mint()` público das reservas testnet.
- Sepolia: `aaveReserves.usdc` populado via Aave Address Book (`0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8`, mesmo endereço que `faucetTokens.usdc` — Aave V3 Sepolia lista esse token como reserve underlying).
- Polygon Amoy: `aaveReserves` omitido — Aave V3 não está deployado em Amoy per Address Book; smoke skipa por design.

### Notes
- Esta mudança é refactor arquitetural, **não** corrige o revert `51 (RESERVE_INACTIVE_OR_NOT_LISTED)` em Sepolia. A hipótese inicial (endereço errado de USDC) foi descartada: Address Book confirma que o endereço atual é o correto. Investigação do root cause real (reserve frozen/paused, supply cap, approval, pool address) fica para task separada.

## [1.7.1] — 2026-04-18

Reconstrução completa do source tree após perda durante reorganização de diretórios. Paridade funcional com 1.7.0 validada via unit tests + smoke tests em Arbitrum Sepolia, Base Sepolia e Polygon Amoy. Primeira versão sob controle git remoto (`gitlab.com:fsa-portfolio/fsa-web3`).

Nenhuma mudança de API ou comportamento.
