# Roadmap — @fsa/web3

Ponto de partida: **v1.7.1** (reconstrução de paridade funcional com v1.7.0, Abr/2026).

---

## v1.8 — débitos da reconstrução (minor, não-breaking)

1. **Ticks canônicos.** Reescrever `src/math/ticks.ts::getSqrtRatioAtTick` em bigint bit-a-bit (estilo Uniswap V3 TickMath). Hoje usa float — `MIN_TICK` / `MAX_TICK` divergem dos canônicos; pode causar off-by-one em pools de preço extremo.
2. **Smoke tests reais.** `uniswap-v3.smoke` habilitado em Sepolia (pool `0x4d8c…327d1`, fee 500, verificado 2026-04-19). `aerodrome.smoke` skipa por design: Aerodrome Finance não tem deployment em Base Sepolia (verificado via `eth_getCode` em 2026-04-19 — código `0x`). Para habilitar aerodrome smoke: aguardar deploy oficial ou usar fork de Base mainnet.
3. **Aave Sepolia fix.** _Status: parcial._ Smoke `aave.smoke — sepolia` ainda falha com revert 51 (reserve not listed). Refactor arquitetural entregue: campo `aaveReserves` separado de `faucetTokens`, consumido pelo smoke. Hipótese "endereço errado" descartada — Address Book confirma o endereço atual como reserve underlying canônico. Root cause real (reserve frozen/paused, supply cap, pool address incorreto) fica para task dedicada.
4. **Remover `as any` residual.** `tests/smoke/uniswap-v3.smoke.test.ts` e `aerodrome.smoke.test.ts` ainda usam — viola regra `rules/typescript.md`.
5. **`ADDRESSES` limpo.** Entradas Sepolia (11155111) e Amoy (80002) foram adicionadas com `wethUsdcPool` apontando pro próprio WETH (placeholder). Trocar por pool real ou tornar campo opcional.
6. **CI publish automático.** Configurar `VERDACCIO_TOKEN` como var protegida no GitLab. Hoje o stage `publish` falha no pipeline do tag — publish é manual.
7. **Known issues do SECURITY.md.** R-03 (retry sem backoff), T-04 (slippage não valida upper bound), L-03 (ausência de deadline default nas txs de escrita). Task 19 registrou sem fix.

---

## v2.0 — API redesign (major, breaking)

1. **Chain-config injetável.** Hoje `ADDRESSES` é const global por `chainId`. Breaking: funções de protocolo recebem `ChainContext` como parâmetro (caller decide endereços). Permite forks, deployments custom e testes sem modificar a lib.
2. **Erros tipados.** Substituir `throw new Error(string)` por classes (`ChainNotSupportedError`, `ReserveInactiveError`, `InsufficientAllowanceError`, etc.). Consumers fazem matching estrutural em vez de regex na mensagem.
3. **Subpath por protocolo em packages separados.** Quebrar em `@fsa/web3-core` + `@fsa/web3-uniswap-v3` + `@fsa/web3-aave` + `@fsa/web3-aerodrome`. Tree-shaking mais agressivo, deps opcionais por bot.
4. **Tipos `viem` explícitos.** Muitos `readContract` retornam `unknown` / tuplas com cast duplo. Usar `ExtractAbiFunction` / `ContractFunctionReturnType` pra inferência automática.
5. **`createClients` multi-transport default.** Aceitar sempre array de RPCs com `fallback({ rank: true })`. Hoje single-url é o caminho comum — v2 força resiliência.
6. **Decimals cache como DI.** `getTokenDecimals` hoje chama on-chain toda vez. v2: receber cache opcional (bot reutiliza entre chamadas, reduz RPC pressure).

---

## Como contribuir

- v1.8: tasks são incrementais e isoladas — cada uma pode virar uma MR.
- v2.0: requer brainstorm + spec antes de escrever código. Abrir issue descrevendo breaking change proposto.
