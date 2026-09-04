# STATE — fsa-web3

- [ ] **Dois episódios do Graphiti não confirmados** — o servidor devolveu `403 Key limit exceeded
      (daily limit)` do OpenRouter durante o `/done` de 2026-09-04, e `add_memory` é fire-and-forget:
      não sei se aterrissaram. Regravar na próxima rodada, `group_id: global-harness`.
      Assunto 1: *gate `/issue-qa` por-issue não substitui a suíte pós-merge* — contexto no commit
      `afc1e10` e na entrada 3.10.0 do CHANGELOG.
      Assunto 2: *`preflight-gate.sh` não está quebrado; só o resolvedor `--worktree issue:N`
      (casa `.issue`, o Orca renomeou para `.linkedIssue`)* — contexto na leitura do próprio hook.
- [ ] **`~/.claude/hooks/preflight-gate.sh`: `--worktree issue:N` continua morto** para todo épico.
      Fix de uma linha: `select(((.issue // .linkedIssue)|tostring)==$i)`. Arquivo fora do escopo
      deste repo ⇒ não editei. Contorno que funciona: path absoluto, `--cwd`, `-C` ou `cd <abs> &&`.
- [ ] **`ROADMAP.md` está obsoleto** — fala de v1.8/v2.0 com o `package.json` agora em 3.10.0.
      Ninguém tocou nesta rodada; ou atualiza ou apaga.
- [ ] **Milestone v3.10 segue aberto** com as 3 issues HITL abaixo. Fechá-lo é decisão do operador,
      não do laço.

## Ordem de ataque (fronteira v3.10)

<!-- Gerado por `~/.claude/scripts/queue-render.py --format state`. Recorte = Milestone,
     ordem = grafo de bloqueio nativo + tipo de atividade. Nota de operador entra como
     sub-bullet e sobrevive a regeneracao; a ORDEM nao se edita a mao — se ela esta
     errada, a aresta esta errada, e o conserto e no forge. -->

**Fronteira de v3.10 — 3 abertas, 0 bloqueadas.**

A fila inteira e derivavel: `~/.claude/scripts/queue-render.py`. O que segue e a
cabeca dela — o resto se lista com o comando, nao se versiona aqui.

*Grelhas (HITL — so com o operador na sala)*

- [decision] [#13](https://github.com/fsa-tools/web3/issues/13) ⚠️ operador — chore(addresses): ADDRESSES[8453] sem entrada aave na Base
- [decision] [#15](https://github.com/fsa-tools/web3/issues/15) ⚠️ operador — feat(simulate): assetDiffs não cobre diffs de posição (health factor)
- [decision] [#16](https://github.com/fsa-tools/web3/issues/16) ⚠️ operador — feat(tx): RECEIPT_CONFIRMATIONS = 2 hardcoded em src/tx/send.ts
