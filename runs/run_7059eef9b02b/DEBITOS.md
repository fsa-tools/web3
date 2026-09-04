# DEBITOS.md — colheita run_7059eef9b02b (v3.10)

Ledger de débitos colhidos dos reports #9–#12. Máx. 3 linhas por débito. `D` = mandados ao
ledger (não viram issue). Issues candidatas ficam de fora daqui — ver lista devolvida ao
orquestrador.

## Mandados ao ledger (portão de admissão reprovou, ou residuo de fix)

1. **Smoke `permit.smoke.test.ts` flakeja no rate limit do RPC público da Base.**
   Classe: rejeitado (corpo já declara "não é defeito do código — é o endpoint gratuito").
   Origem: report-9.md §Débitos item 3. Ação: comentário no #9, nenhuma issue.

2. **`supportsPermit` usa `zeroAddress` como probe de `nonces`; token que reverte especificamente
   em `nonces(0x0)` seria classificado errado.** Classe: rejeitado (especulativo, sem caso real —
   "registro por honestidade"). Origem: report-9.md §Débitos item 4. Ação: comentário no #9.

3. **Tradução de erro Aave roda sobre qualquer `Error(string)` numérico, não só Aave Pool.**
   Classe: rejeitado (risco aceito e já registrado pelo implementador, baixa probabilidade,
   sem decisão pendente). Origem: report-10.md §Decisão 5. Ação: comentário no #10.

4. **`ChainContext.walletClient` exige `chain` definido no client injetado.** Classe: rejeitado
   (restrição já decidida como desejável para o Atlas, não é decisão em aberto). Origem:
   report-11.md §Débitos item 2. Ação: nota no README já cobre o essencial; comentário no #11.

5. **`tests/types/viem-inference.test-d.ts` sem caso para `walletClient` injetado.** Classe:
   resíduo do próprio fix de #11 (typecheck já cobre via outros testes). Ação: checklist na
   issue #11, não issue nova.

6. **`report-12.md` foi commitado junto do diff em `a221f33`.** Classe: resíduo do próprio fix
   de #12 (artefato de worker no histórico). Ação: checklist na issue #12 — remover antes do
   merge/PR final.

## Issues candidatas (portão aprovou — devolvidas para criação em lote)

7. **`ADDRESSES[8453]` sem entrada `aave`, embora Aave V3 exista na Base.** Classe B
   (`debt:decision`). Origem: report-9.md §Débitos item 1 + gate #9 + conhecido a priori pelo
   orquestrador (pool `0xA238...d1c5` hardcoded em 3 arquivos de teste).

8. **`ERC20_ABI` não tem `name()`, duplicado em `ERC20_PERMIT_ABI`.** Classe A. Origem:
   report-9.md §Débitos item 2 (candidato a consolidação, sem efeito em produção).

9. **`assetDiffs` não cobre "posição" (ex.: health factor da Aave), só saldo ETH/ERC20.**
   Classe B (`debt:decision`). Origem: report-10.md §O que falta + gate #10 (classificado
   follow-up não-bloqueante) + conhecido a priori pelo orquestrador.

10. **`RECEIPT_CONFIRMATIONS = 2` hardcoded em `src/tx/send.ts`.** Classe B (`debt:decision`).
    Origem: report-11.md §Débitos item 1 (custa ~4s extras por tx no navegador; candidato a knob).

11. **`ensureAllowance` e wrappers de protocolo nunca exercitados com `walletClient` injetado.**
    Classe A. Origem: report-11.md §Débitos item 4 (inferência, não medição; relevante se Atlas
    usar `supply`/`mintPosition` direto do browser).
