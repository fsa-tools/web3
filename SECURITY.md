# Security Notes

## Known Issues (v1.7.x)

Os itens abaixo foram identificados na auditoria DeFi do vfat-monitor (abril/2026). Serão endereçados em v1.8.0 sob spec separada.

### R-03 — Transaction confirmations default=1
`waitForTransactionReceipt` em `src/protocols/*/mint.ts`, `decrease.ts` etc. passa apenas `{ hash }` — sem `confirmations`. Risco baixo em L2 (Base/Arbitrum têm fast finality), mas best practice é `confirmations: 2`.

### T-04 — Approval race (ensureAllowance sem approve(0))
`src/utils/erc20.ts` faz `approve(MAX_UINT256)` sem `approve(0)` prévio. Tokens como USDT revertem se allowance atual ≠ 0.

### L-03 — IL estimation pre-entry (em vfat-monitor, não nesta lib)
Listado aqui apenas para rastreabilidade cross-repo.

## Reporting

Issues de segurança: abrir MR privado no GitLab ou email pro maintainer.
