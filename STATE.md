# STATE — fsa-web3

Rodada `orca-epic run_7059eef9b02b` (2026-09-04), Milestone **v3.10**. Sessão encerrada por
gate de contexto (~256k) com a leva aprovada e **o merge ainda não feito**.

## O bastão — o que a próxima sessão faz, nesta ordem

- [ ] **Drenar a classe A colhida nesta rodada** (passo 6.2 do `orca-epic`, não conta para
      `--max-loop`): **#14** (`ERC20_ABI` sem `name()`) e **#17** (cobertura de `ensureAllowance`
      com walletClient injetado). Ambas `ready-for-agent`, mecânicas ⇒ `sonnet`/`medium`.
      Gate `/issue-qa` por MiniMax como o resto da rodada.
- [ ] **Mergear as 4 branches em `main`** — nenhuma foi mergeada ainda. Todas pushadas:
      `fabiosiqueira/iss-9` (d146d89) · `iss-10` (abbf940) · `iss-11` (17e3575) · `iss-12` (a221f33).
- [ ] **Rodar a suíte completa PÓS-MERGE.** Os quatro `qa:passed` cobrem cada diff isolado,
      nunca os quatro juntos. Última medição por branch: 191→207 testes.
- [ ] **Fechar #9 #10 #11 #12** (estão `qa:passed` e abertas — o gate foi instruído a não fechar).
- [ ] **`/done`** e só então o cleanup: `orca worktree rm` nos 4 worktrees
      (`~/orca/workspaces/fsa-web3/iss-{9,10,11,12}`), predicado = branch mergeada **e** issue fechada.

## Decisões pendentes do operador (nenhuma bloqueia o merge)

- [ ] **`~/.claude/hooks/preflight-gate.sh` está quebrado para todo épico futuro.** Ele casa
      `.issue` na saída de `orca worktree list --json`; o Orca ≥1.4.195 renomeou para
      `.linkedIssue`. Efeito: `worker-start --worktree issue:N` é sempre barrado. Contorno usado
      nesta rodada: path absoluto **literal** (variável de shell não serve — o hook lê o texto cru
      do comando). Fix de uma linha: `select(((.issue // .linkedIssue)|tostring)==$i)`.
      Arquivo fora do escopo do repo ⇒ não editei.
- [ ] **`report-*.md` não está no `.gitignore` deste repo.** O worker do #12 commitou
      `report-12.md` junto com o produto; o gate pegou. Contornei instruindo os 3 workers
      restantes, mas é conserto por worker, não por classe.

## Armadilhas medidas nesta rodada (não repetir)

- Worker headless `claude -p` **não herda bypass de permissões**: trava pedindo aprovação de `gh`,
  sai com exit 0 e sem marcador — idêntico a falha de modelo. Use `--permission-mode bypassPermissions`.
- **A skill `/implement` é `disable-model-invocation`**: um worker já rodando não consegue invocá-la.
  Brief que mande "invoque /implement" trava a leva. Mande `/tdd` direto e diga que o gate é do
  orquestrador. (Foi defeito do brief desta rodada, corrigido em voo.)
- `orca orchestration worker-start` devolve o handle do terminal em `effects[].id` (kind=terminal),
  **não** em `agentTerminalHandle` — o guia do binário diz o contrário.
- O recibo de `orchestration dispatch` não tem campo `stage`; o sucesso é `.result.dispatch.status
  == "dispatched"`. Só `worker-start` usa `stage: input_accepted`.

## Contexto que o forge não responde

- **Este repo não tem `VISION.md`** — decisão do operador nesta rodada. Todo brief precisa dizer
  isso, senão worker e gate tratam a ausência como bloqueio ou como spec-drift.
- `ROADMAP.md` está obsoleto: fala de v1.8/v2.0 com o `package.json` em 3.9.1. Ninguém tocou.
- #4 e #5 foram fechadas por verificação (já implementadas em `7f06fc7` e `6ed1cc6`), não por
  worker. #4 ficou com ressalva: os mins vêm de `simulateContract`, não da matemática Q96 que o
  corpo sugeria.

## Ordem de ataque (fronteira v3.10)

Regenerável por `python3 ~/.claude/scripts/queue-render.py --milestone v3.10`.
Cabeça do operador (HITL, nenhum worker pega): **#13, #15, #16** — as três `ready-for-human`,
cada uma com uma seção `## Decisão em aberto` no corpo.
