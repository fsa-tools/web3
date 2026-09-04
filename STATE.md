# STATE — fsa-web3

Rodada `orca-epic run_7059eef9b02b` (2026-09-04), Milestone **v3.10**. 2ª sessão da cadeia
(a 1ª encerrou por gate de contexto ~256k). **O merge já foi feito.**

## O que esta sessão já fechou

- **As 4 branches estão em `main`** (`--no-ff`, sem conflito) e pushadas: `afc1e10`.
  `iss-9` d146d89 · `iss-10` abbf940 · `iss-11` 17e3575 · `iss-12` a221f33.
- **#9 #10 #11 #12 fechadas** — o `Closes #N` dos merge commits disparou no push.
- **Veredito cross-repo postado** em `fabiosiqueira/defi-project#463` (convenção que o próprio
  #12 introduziu): comment-5547595484.
- **Suíte pós-merge: 233/233**, typecheck e build limpos.
- `report-12.md` **removido** do merge (tinha entrado no commit da branch) e `report-*.md`
  adicionado ao `.gitignore` — a armadilha era por-worker, agora é por-classe.

## O bastão — o que falta

- [ ] **Dreno da classe A em voo** (passo 6.2, não conta para `--max-loop`): **#14**
      (`term_92bec60b`, sonnet/medium, worktree `iss-14`) e **#17** (`term_6e0a4723`,
      sonnet/high, worktree `iss-17`). Watcher armado. Gate `/issue-qa` por **MiniMax**
      (degrau 2 — o degrau 1, Grok, está com sign-in expirado).
- [ ] Mergear #14/#17 aprovados, rodar a suíte de novo, fechar as issues.
- [ ] **`/done`** e só então o cleanup: `orca worktree rm` nos 6 worktrees
      (`~/orca/workspaces/fsa-web3/iss-{9,10,11,12,14,17}`), predicado = branch mergeada
      **e** issue fechada.

## Achado desta sessão — falha que só o merge expõe

O fitness test `tests/unit/browser-safety.test.ts` (de **#11**) acusava `src/abis/aave-errors.ts`
(de **#10**) por um JSDoc que cita `require(cond, Errors.X)` do Solidity. Comentário não é runtime.
**Nenhum `qa:passed` isolado podia pegar isto** — cada gate viu um diff só. Fix em `afc1e10`: a
varredura ignora comentários; provado que ofensor real em código continua quebrando o teste.
Lição: gate por-issue não substitui suíte pós-merge.

## Decisões pendentes do operador

- [ ] **`~/.claude/hooks/preflight-gate.sh` — o diagnóstico da 1ª sessão estava incompleto.**
      O hook **funciona** com `--worktree <path-absoluto>` / `--cwd` / `-C` / `cd <abs> &&`; o que
      quebrou foi só o resolvedor `--worktree issue:N`, que casa `.issue` na saída de
      `orca worktree list --json` e o Orca ≥1.4.195 renomeou para `.linkedIssue`. Fix de uma linha:
      `select(((.issue // .linkedIssue)|tostring)==$i)`. Arquivo fora do escopo do repo ⇒ não editei.
      ⚠️ O marcador `orca-preflight.ok` que ele exige é legítimo — rode
      `bash ~/.claude/scripts/preflight-dispatch.sh <worktree>` antes de despachar, não contorne.

## Armadilhas medidas nesta rodada (não repetir)

- Worker headless `claude -p` **não herda bypass de permissões**: trava pedindo aprovação de `gh`,
  sai com exit 0 e sem marcador — idêntico a falha de modelo. Use `--permission-mode bypassPermissions`.
- **A skill `/implement` é `disable-model-invocation`**: um worker já rodando não consegue invocá-la.
  Brief que mande "invoque /implement" trava a leva. Mande `/tdd` direto.
- `orca orchestration worker-start` devolve o handle do terminal em `effects[].id` (kind=terminal),
  **não** em `agentTerminalHandle`.
- `worker-start` exige `--task <id>`: `task-create` primeiro, e `run-use --id <run>` antes de tudo
  numa sessão nova (o binding de coordinator é por terminal, não sobrevive ao handoff).
- O recibo de `orchestration dispatch` não tem campo `stage`; o sucesso é `.result.dispatch.status
  == "dispatched"`. Só `worker-start` usa `stage: input_accepted`.

## Contexto que o forge não responde

- **Este repo não tem `VISION.md`** — decisão do operador. Todo brief precisa dizer isso, senão
  worker e gate tratam a ausência como bloqueio ou como spec-drift.
- `ROADMAP.md` está obsoleto: fala de v1.8/v2.0 com o `package.json` em 3.9.1.
- #4 e #5 foram fechadas por verificação (já implementadas em `7f06fc7` e `6ed1cc6`). #4 ficou com
  ressalva: os mins vêm de `simulateContract`, não da matemática Q96 que o corpo sugeria.

## Ordem de ataque (fronteira v3.10)

Regenerável por `python3 ~/.claude/scripts/queue-render.py --milestone v3.10`.
Cabeça do operador (HITL, nenhum worker pega): **#13, #15, #16** — as três `ready-for-human`,
cada uma com uma seção `## Decisão em aberto` no corpo.
