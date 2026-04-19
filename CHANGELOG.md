# Changelog

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
