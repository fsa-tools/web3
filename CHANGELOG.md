# Changelog

## 3.4.0 — 2026-06-06

### Added
- `approvalMode?: 'exact' | 'unlimited'` em `ensureAllowance` (default `'unlimited'` = `MAX_UINT256`, retrocompat) —
  modo opt-in de approval exato (`approve(amount)`) para reduzir a superfície de allowance ilimitada concedida ao spender.
- Flag `approvalMode` propagada por `MintOperationParams`/`SwapOperationParams` de `uniswap-v3` e `aerodrome` (mint + swap).
- Tipo `ApprovalMode` exportado de `@fsa-tools/web3/utils`.

## 3.3.0 — 2026-05-30

### Added
- `aerodrome.planSwapExactInputSingle({ tokenIn, tokenOut, tickSpacing, amountIn, routerAddress, recipient, amountOutMinimum, deadline })` —
  planner puro do swap `exactInputSingle` no Aerodrome Slipstream, retornando `[approve, SwapRouter.exactInputSingle]`.
- `aerodrome.swapExactInputSingle(ctx, params)` / `aerodrome.quoteExactInputSingle(ctx, params)` —
  execução e cotação single-hop via SwapRouter/Quoter do Slipstream (paridade com `uniswap-v3`).
- ABIs `AERODROME_SWAP_ROUTER_ABI` / `AERODROME_QUOTER_ABI` (Slipstream: `tickSpacing` int24, `deadline` no router).
- Endereços Base (8453): `aerodrome.swapRouter` e `aerodrome.quoter`.

## 3.2.0 — 2026-05-29

### Added
- `aerodrome.planMint / planDecreaseLiquidity / planCollectFees / planBurnPosition` —
  planners puros (`TxRequest[]`) das 4 operações de LP, espelhando o calldata das funções
  de execução (`AERODROME_NPM_ABI`, `tickSpacing`, `nftId`→`tokenId`, `sqrtPriceX96`).
- `uniswapV3.planSwapExactInputSingle({ tokenIn, tokenOut, fee, amountIn, routerAddress, recipient, amountOutMinimum })` —
  planner puro do swap `exactInputSingle`, retornando `[approve, SwapRouter.exactInputSingle]`.

## 3.1.2 — 2026-05-25

### Changed
- Migração de repositório: `gitlab.com/fsa-portfolio/fsa-web3` → `github.com/fsa-tools/web3`.
- Scope do pacote: `@fsa/web3` → `@fsa-tools/web3`.
- Registry de publicação: Verdaccio interno → GitHub Packages (`npm.pkg.github.com`).
- CI: GitHub Actions substitui o pipeline GitLab; publish automático em tag `v*.*.*`.

## 3.1.1 — 2026-05-22

### Added
- `aave.planRepay({ asset, amount, interestRateMode, onBehalfOf, poolAddress })` —
  monta `[approve, Pool.repay]` simétrico a `planSupply`. ABI da Pool agora expõe `repay`.
- Tipos `PlanRepayParams`, `RepayOperationParams`, `RepayResult`.

## 3.1.0 — 2026-05-21

### Added
- `TxRequest` type + `tx/` module: descritor de transação preparada-mas-não-enviada.
- Path `encode/plan`: `planMint`/`planDecreaseLiquidity`/`planCollectFees`/`planBurnPosition`
  (uniswap-v3) e `planSupply`/`planWithdraw` (aave) — devolvem `TxRequest[]` sem enviar.
- `sendTxRequest` — o lado `send` do split `plan + send`.

### Changed
- Ops uniswap-v3 (`mint`/`decrease`/`collect`/`burn`) e aave (`supply`/`withdraw`)
  passam a montar a calldata da operação principal via os `plan*` (split `plan + send`).
  Comportamento de execução preservado; aerodrome e `swapExactInputSingle` não tocados.

## [3.0.0] — 2026-05-16

### Added

- `quoteExactInputSingle` (uniswap-v3): cotação real de swap single-hop via QuoterV2 — simula o swap on-chain e retorna `amountOut` já com fee do pool e price impact descontados. Retorna também `sqrtPriceX96After` e `initializedTicksCrossed`.
- `QUOTER_V2_ABI` + endereço `quoter` por chain em `ProtocolAddresses` (Base, Ethereum, Optimism, Arbitrum, Polygon).

### Changed

- **BREAKING** `swapExactInputSingle`: `amountOutMinimum` agora deriva da cotação do QuoterV2 (com fee + price impact), não mais de `spotAmountOut` (estimativa marginal sem impacto). Em pools de baixa liquidez o spot estourava a tolerância de slippage e o swap revertia `Too little received`.
- **BREAKING** `SwapOperationParams`: campo `sqrtPriceX96` removido — não é mais necessário, a cotação vem do QuoterV2.

## [2.2.0] — 2026-05-16

### Added

- `computeDepositRatio` (math): fração de valor token0 para depósito Uniswap V3 dado o range e o preço atual
- `spotAmountOut` (math): quote spot single-hop sem price impact
- `swapExactInputSingle` (uniswap-v3): wrapper do SwapRouter02 (`exactInputSingle`) com `amountOutMinimum` derivado de slippage
- `swapRouter` por chain em `ChainAddresses` + `SWAP_ROUTER_ABI`

## [2.1.0] — 2026-05-14

### Added

- `mintPosition` (uniswap-v3 e aerodrome): `ensureAllowance` de token0 e token1 embutido antes do mint — corrige revert `STF` por allowance ausente

> Nota: publicado no Verdaccio em 2026-05-14, mas o código-fonte só foi commitado em 2026-05-16 (entrada retroativa).

## [2.0.1] — 2026-05-14

### Fixed

- Endereço do Uniswap V3 Factory para Base (chainId 8453) corrigido: era `0x1F98431c8aD98523631AE4a59f267346ea31F984` (Ethereum mainnet), correto é `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`

## [2.0.0] — 2026-04-20

### Breaking Changes

#### API de Funções
Todas as funções de protocolo e utils agora recebem `(ctx: ChainContext, params)` em vez de flat object.

| Função | Assinatura v1.x | Assinatura v2.0 |
|--------|-----------------|-----------------|
| `mintPosition` (uniswap-v3) | `(params: MintParams)` | `(ctx, params: MintOperationParams)` |
| `mintPosition` (aerodrome) | `(params: AerodromeMintParams)` | `(ctx, params: MintOperationParams)` |
| `decreaseLiquidity` | `(params: DecreaseParams)` | `(ctx, params: DecreaseOperationParams)` |
| `collectFees` | `(params: CollectParams)` | `(ctx, params: CollectOperationParams)` |
| `burnPosition` | `(params: BurnParams)` | `(ctx, params: BurnOperationParams)` |
| `supply` (aave) | `(params: SupplyParams)` | `(ctx, params: SupplyOperationParams)` |
| `withdraw` (aave) | `(params: WithdrawParams)` | `(ctx, params: WithdrawOperationParams)` |
| `getPositionValue` | `(params: GetPositionValueParams)` | `(ctx, params: GetPositionValueOperationParams)` |
| `getUserAccountData` | `(params: GetUserAccountDataParams)` | `(ctx, params: GetUserAccountDataOperationParams)` |
| `getTokenDecimals` | `({ publicClient, token })` | `(ctx, { token })` |
| `ensureAllowance` | `({ publicClient, walletClient, ... })` | `(ctx, { token, spender, amount })` |
| `getBalance` | `({ publicClient, token, owner })` | `(ctx, { token, owner })` |
| `estimateGas` | `({ publicClient, to, ... })` | `(ctx, { to, ... })` |
| `withGasGuard` | `(fn, { publicClient, ... })` | `(ctx, fn, { ... })` |
| `estimateDryRunCost` | `({ publicClient, ... })` | `(ctx, { ... })` |
| `getEthPriceUsd` | `({ publicClient, wethUsdcPoolAddress })` | `(ctx, { wethUsdcPoolAddress })` |
| `getCurrentPrice` | `({ publicClient, poolAddress })` | `(ctx, { poolAddress })` |

#### Remoções
- `createClients` removido de `@fsa/web3/utils` — use `createChainContext` de `@fsa/web3/context`
- `_resetCache()` removido do módulo `decimals` — cache agora é `ctx.decimalsCache` (Map injetável via ChainContext)
- Tipos renomeados: `MintParams → MintOperationParams`, `SupplyParams → SupplyOperationParams`, `WithdrawParams → WithdrawOperationParams`, `DecreaseParams → DecreaseOperationParams`, `BurnParams → BurnOperationParams`, `CollectParams → CollectOperationParams`

#### Erros
- Todos os `throw new Error(string)` substituídos por classes tipadas — catching por `instanceof` agora funciona
- Construtores com campos públicos: `ChainNotSupportedError.chainId`, `ProtocolNotSupportedError.protocol`, `SlippageExceededError.bps/max`, `ReceiptEventNotFoundError.eventName/txHash`

### Added
- `ChainContext` — contrato central injetável (`publicClient`, `walletClient?`, `addresses`, `decimalsCache?`)
- `createChainContext(params)` — cria contexto com transport fallback (`viem fallback()`) sempre ativo; suporta `rpcUrls: string[]`
- Typed errors em `src/errors.ts`: `ChainNotSupportedError`, `ProtocolNotSupportedError`, `ReserveInactiveError`, `InsufficientAllowanceError`, `SlippageExceededError`, `AddressValidationError`, `ReceiptEventNotFoundError`
- Exports `./errors` e `./context` em `package.json`
- `tests/types/viem-inference.test-d.ts` — type-level tests para ChainContext e erros tipados
- `tests/smoke/context.smoke.test.ts` — smoke test de fallback RPC

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

## [1.7.1] — 2026-04-18

Reconstrução completa do source tree após perda durante reorganização de diretórios. Paridade funcional com 1.7.0 validada via unit tests + smoke tests em Arbitrum Sepolia, Base Sepolia e Polygon Amoy. Primeira versão sob controle git remoto (`gitlab.com:fsa-portfolio/fsa-web3`).

Nenhuma mudança de API ou comportamento.
