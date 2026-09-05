# Changelog

## Unreleased

### Added
- `SimulateTxRequestsOptions.probes` / `SimulateTxRequestsResult.probeDiffs` (`src/simulate/`): mecanismo
  protocolo-agnóstico de leitura `view` (`SimulationProbe`) que o simulador prefixa e sufixa no mesmo batch de
  `eth_simulateV1` — pré e pós vêm do mesmo bloco, com o estado encadeado, sem RPC extra. Sem `probes`, o batch
  é idêntico ao atual; probe que reverte (pré ou pós) lança erro nomeando o label, nunca deixa `pre`/`post`
  ausente em silêncio. Só surte efeito no caminho chained — no fallback isolado `probeDiffs` fica `undefined`,
  igual a `assetDiffs`. Primeiro helper: `aaveAccountDataProbe(ctx, user)` em `@fsa-tools/web3/aave`, que decodifica
  `getUserAccountData` para o shape de `AccountData` (inclui `healthFactor`) e lança `ProtocolNotSupportedError`
  sem aave no ctx. (#15)
- `ADDRESSES[8453].aave.pool` (`src/constants/addresses.ts`): o Pool da Aave V3 na Base entra no registry como
  as outras chains, então `aave.supply()` / `withdraw()` / `getUserAccountData()` funcionam na Base via
  `ctx.addresses.aave` em vez de lançar `ProtocolNotSupportedError`. Os testes que hardcodavam o endereço
  passam a lê-lo do registry. (#13)

## 3.10.0 — 2026-09-04

### Added
- `planSupplyWithPermit` / `planRepayWithPermit` (`src/protocols/aave/plan.ts`): supply e repay do Aave V3 com
  aprovação por assinatura EIP-2612, eliminando a transação de `approve` separada. Inclui detecção de suporte a
  permit no token (`src/utils/permit.ts`) e o `ERC20_PERMIT_ABI`. A primitiva foi exercitada contra a Base
  mainnet no smoke test, não só em unit. (#9)
- Módulo `simulate` (`src/simulate/`): `eth_simulateV1` com fallback automático para `eth_call` em RPC que não
  o suporta (`method-support.ts`), e revert decodificado — incluindo os códigos numéricos de erro do Aave V3
  (`src/abis/aave-errors.ts`), que o protocolo emite como string numérica. Exportado em `./simulate`. (#10)
- `ChainContext` aceita `walletClient` injetado (EIP-1193/6963), de modo que `sendTxRequest` deixa de exigir
  `privateKey` — é o que permite assinar com a carteira de uma extensão de navegador. `signTypedData` exposto em
  `src/tx/sign.ts`. Fitness test novo (`tests/unit/browser-safety.test.ts`) barra qualquer dependência do
  runtime Node em `src/`, para que regressão de portabilidade quebre o build desta lib. (#11)
- `name()` no `ERC20_ABI` base; `ERC20_PERMIT_ABI` passa a reaproveitar a entrada em vez de duplicá-la. (#14)

### Fixed
- `browser-safety.test.ts` ignora comentários ao varrer `src/`: um JSDoc que citava `require(cond, Errors.X)` do
  Solidity fazia o fitness test acusar `src/abis/aave-errors.ts`. Falha só observável com os merges de #10 e #11
  juntos — nenhum gate por-issue podia pegá-la.

### Tested
- Cobertura de `ensureAllowance` e dos wrappers de protocolo (Aave `supply`, Uniswap V3 `mintPosition`,
  Aerodrome `swapExactInputSingle`) com `walletClient` injetado. Nenhuma mudança de produção foi necessária: a
  cobertura confirmou o comportamento que antes era inferência. (#17)

### Docs
- `CLAUDE.md`: convenção cross-repo — issue aberta a pedido de outro repo carrega `Blocks <owner/repo>#N` no
  corpo, e quem a fecha posta o veredito na issue solicitante. (#12)

## 3.9.1 — 2026-07-25

### Fixed
- `getEthPriceUsd` (`src/utils/gas.ts`) agora lê `token0()` do pool e inverte o preço quando WETH é `token1`,
  em vez de assumir a orientação da Base (WETH=`token0`, USDC=`token1`). Em chain cujo pool WETH/USDC ordena
  USDC primeiro — Ethereum mainnet, `0x88e6A0c2…5640` — a fórmula antiga devolvia `priceRaw × 1e12 ≈ 5.38e20`
  em vez de ~US$1.9e3, inflando `equity`/`availableUSD` do consumidor em ~1e17× e fazendo gates de estratégia
  decidirem sobre capital fictício. A comparação usa `isAddressEqual` contra `ctx.addresses.weth` — case-insensitive,
  porque as constantes de endereço misturam checksummed e lowercase. O ajuste de decimais segue `1e12` nas duas
  orientações (|dec(WETH) − dec(USDC)| = 12), mudando de multiplicador para numerador quando invertido.

  **Ressalva para consumidores:** a chamada passa a emitir **dois** reads (`slot0` + `token0`, em paralelo via
  `Promise.all`) e exige que o contrato do pool exponha `token0()` — o que vale para Uniswap V3 e Aerodrome
  Slipstream. O `token0()` é lido sempre com o `POOL_ABI` interno, então um `poolAbi` de caller que declare
  apenas `slot0` continua funcionando. (ref #8)

## 3.9.0 — 2026-07-13

### Added
- `PositionResult` (`mintPosition`) e `SwapResult` (`swapExactInputSingle`) — Aerodrome e Uniswap V3 —
  agora carregam `approvalReceipts: TransactionReceipt[]`: os receipts das txs de approve ERC20 disparadas
  internamente via `ensureAllowance` antes da operação principal. Sempre presente (`[]` quando nenhum
  approve foi necessário). As demais operações (`decreaseLiquidity`, `collectFees`, `burnPosition`,
  `quoteExactInputSingle`) não aprovam nada e ficaram inalteradas.
- `AllowanceResult` (de `ensureAllowance`) carrega `receipts: TransactionReceipt[]` no mesmo formato.
  O campo `txHash?` existente continua intacto — mudança não-breaking.
- Como efeito colateral: `ensureAllowance` pode emitir **duas** txs — o reset-para-zero (`approve(0)`,
  quando a allowance corrente é `> 0` mas `< amount`) e o approve final. O hash do reset não era exposto
  em lugar nenhum; agora o receipt dele vem no array, na ordem de envio.

  **Porquê:** os approves gastam gás, mas os results só carregavam dados da tx principal — o consumidor
  nem sabia que os approves existiram, e o custo de entrada que ele calculava subestimava o gás, com viés
  sistemático e sempre para baixo. `ensureAllowance` já aguarda o receipt de cada tx (desde 3.6.1) e os
  descartava; devolvê-los custa **zero RPC extra** e entrega `gasUsed`, `effectiveGasPrice` e, na
  Base/OP-stack, `l1Fee`. Devolver só os hashes forçaria o chamador a rebuscar cada receipt — exatamente
  o custo que a 3.8.0 acabou de eliminar para a tx principal. Ressalva: o tipo `TransactionReceipt` do
  viem **não** declara `l1Fee` — o campo chega em runtime pelo chain formatter da Base, então quem
  precisar dele na OP-stack faz um cast. Decisão consciente: tipar o receipt pela chain vazaria generics
  para toda a API pública da lib.

## 3.8.0 — 2026-07-13

### Added
- Todos os resultados de operação que já carregavam `gasUsed` agora carregam também `effectiveGasPrice`
  (mint, decrease, collect, burn, swap — Aerodrome e Uniswap V3). O receipt já estava em mãos; sem isso o
  chamador precisava **rebuscar o receipt** só para calcular o custo em USD — +1 RPC por trade.

## 3.7.0 — 2026-07-13

### Added
- `mintPosition` (Aerodrome e Uniswap V3) aceita `amount0Min`/`amount1Min` explícitos, como
  `decreaseLiquidity` já fazia. Quando ausentes, seguem derivados do `slippageBps` — comportamento
  inalterado para quem não passa os mins.

  **Porquê:** derivar o min do `amountDesired` amarra o min ao preço do instante em que os amounts
  foram calculados. O pool consome os tokens na proporção do preço corrente dentro do range, então
  qualquer drift de preço até a TX ser minada encolhe uma das pernas abaixo do seu min e o NPM
  reverte com `PSC` (price slippage check) — 1 tick de drift basta num range estreito. Com os mins
  explícitos, quem conhece a banda de preço tolerada calcula os mins nela (à la
  `mintAmountsWithSlippage` do Uniswap SDK) e passa prontos.

## 3.6.1 — 2026-07-07

### Fixed
- `ensureAllowance` (`src/utils/erc20.ts`) agora aguarda o receipt do `approve` final (`waitForTransactionReceipt`)
  antes de resolver, espelhando o path do reset `approve(0)`. Antes retornava logo após enviar a tx; sob block time
  > 0 (Base ~2s, Anvil `--block-time N`) uma sequência `approve → mint`/`swap` no mesmo ciclo revertia com
  `allowance` ainda `0` (approve não minerado). Consumidores não precisam mais replicar o `waitForTransactionReceipt`
  no adapter. (ref #6)

## 3.6.0 — 2026-07-07

### Added
- `slippageBps?: number` em `DecreaseOperationParams` do Aerodrome (`decreaseLiquidity`) — quando presente e os mins
  ausentes, deriva `amount0Min`/`amount1Min` por simulação (`simulateContract` com mins `0n` + `applySlippage`),
  espelhando o path do `uniswap-v3`. Mins explícitos têm precedência (override). Omitir `slippageBps` mantém o
  comportamento anterior (`?? 0n`, sem simulação). (ref #4)

### Fixed
- `is429` (`withCooldown`, pool RPC) agora reconhece 429 em múltiplas shapes — `.status`/`.statusCode` numéricos e
  sinais textuais (`429` / `too many requests` / `rate limit`) em `.message`/`.statusText` — percorrendo a cause-chain;
  magic numbers extraídos para constantes nomeadas (`CAUSE_CHAIN_MAX_DEPTH`, `HTTP_TOO_MANY_REQUESTS`). (ref #5)

## 3.5.0 — 2026-06-08

### Added
- `rpc?: RpcOptions` em `CreateChainContextParams` (`createChainContext`) — knobs opt-in de resiliência RPC:
  `timeoutMs`/`retryCount` repassados ao `http()` interno; `cooldownMs` pula um provider 429'd pela janela de cooldown;
  `maxConcurrency` limita eth_calls concorrentes por chain via semáforo in-house (sem dep nova). Omitir `rpc` mantém o
  transport idêntico ao anterior (retrocompat absoluta). (ref #3)
- Tipo `RpcOptions` exportado de `@fsa-tools/web3/context`.

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
