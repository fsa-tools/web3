# Security Notes

## Known Issues (v1.7.x) — resolvidos em v1.8.x

### R-03 — Transaction confirmations default=1 ✓ resolvido em v1.8.1
`waitForTransactionReceipt` em todos os entry points agora usa `confirmations: 2`.

### T-04 — Approval race (ensureAllowance sem approve(0)) ✓ resolvido em v1.8.1
`ensureAllowance` agora emite `approve(0)` e aguarda receipt antes de `approve(MAX_UINT256)` quando `currentAllowance > 0`.

### L-03 — IL estimation pre-entry (em vfat-monitor, não nesta lib)
Listado aqui apenas para rastreabilidade cross-repo.

## Reporting

Issues de segurança: abrir MR privado no GitLab ou email pro maintainer.
