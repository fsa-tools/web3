# Report — Issue #12

## O que mudou
- `CLAUDE.md`: nova seção "Convenção cross-repo (issues)" documentando:
  1. Issue aberta neste repo a pedido de outro repo do workspace deve carregar `Blocks <owner/repo>#N` no corpo.
  2. Quem fecha uma issue com `Blocks` posta o veredito resumido como comment na issue solicitante, com footer `— 🤖 <modelo>`.

## Decisões não-óbvias
- Issue é documentação pura (categoria `documentation`, "Key interfaces: none"). Não havia seam de código/teste para TDD — a issue em si já nomeia isso em "Out of scope": nenhuma automação/tooling.
- #9, #10, #11 já citadas na issue como conformes (cada uma já carrega `Blocks fabiosiqueira/defi-project#463`) — não editei retroativamente essas três, conforme "Out of scope" explícito.

## Desvio de método (reportar ao orquestrador)
- A tarefa pedia para invocar a skill `/implement` (que dirige `/tdd`). A skill está registrada com `disable-model-invocation` e o `Skill` tool recusou a chamada, orientando a pedir para o usuário rodar `/implement` diretamente — o que não é possível numa sessão de worker sem operador interativo digitando o slash command.
- Dado que a issue é 100% documentação (sem seams de código, sem testes aplicáveis), implementei a mudança diretamente no `CLAUDE.md` e revalidei a suite (191/191, 34 arquivos) antes e depois — sem alteração de comportamento de código, então TDD não se aplicava de qualquer forma.
- Não rodei `/issue-qa` (gate é do orquestrador, outra família de modelo).

## Débito / achado fora de escopo
- Nenhum achado fora de escopo durante a implementação.

## Suite
- Baseline antes: 191 testes / 34 arquivos, verde.
- Depois da mudança: 191 testes / 34 arquivos, verde (mudança é só documentação, sem impacto em runtime).
