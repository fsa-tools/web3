# STATE — fsa-web3

- [ ] **Milestone v3.10 segue aberto com 0 issues abertas (11 fechadas)** — a v3.11.0 saiu com as 3
      `debt:decision` drenadas (#13 #15 #16). Fechar o milestone e abrir o v3.11 é decisão do operador.
- [ ] **`~/.claude/hooks/preflight-gate.sh`: `--worktree issue:N` continua morto** para todo épico.
      Fix de uma linha: `select(((.issue // .linkedIssue)|tostring)==$i)`. Arquivo fora do escopo
      deste repo ⇒ não editei. Contorno: path absoluto, `--cwd`, `-C` ou `cd <abs> &&`.
- [ ] **`ROADMAP.md` está obsoleto** — fala de v1.8/v2.0 com o `package.json` em 3.11.0. Ou atualiza ou apaga.
- [ ] **2 episódios do Graphiti (`global-harness`) enfileirados no `/done` de 2026-09-04 e não
      confirmados por `get_episodes`** (extração assíncrona): *Grok com cota 0% estagna o dispatch e só o
      rodapé do TUI denuncia* e *`orca orchestration task-create --json` não parseia com jq quando o spec
      é multilinha — grep `task_`*. Contexto: STATE.md desta rodada (este item). Regravar se ausentes.
- [ ] **Grok com cota semanal em 0% em 2026-09-04** — gate `/issue-qa` correu inteiro no degrau 2
      (MiniMax-M3). Reset: ver `orca account list`; até lá todo gate começa no degrau 2.

## Ordem de ataque (fronteira v3.10)

<!-- Gerado por `~/.claude/scripts/queue-render.py --format state`. Recorte = Milestone,
     ordem = grafo de bloqueio nativo + tipo de atividade. Nota de operador entra como
     sub-bullet e sobrevive a regeneracao; a ORDEM nao se edita a mao — se ela esta
     errada, a aresta esta errada, e o conserto e no forge. -->

**Fronteira de v3.10 — 0 abertas, 0 bloqueadas.**

A fila inteira e derivavel: `~/.claude/scripts/queue-render.py`. O que segue e a
cabeca dela — o resto se lista com o comando, nao se versiona aqui.
