# fsa-web3

## Packages
```yaml
packages:
  - name: "@fsa-tools/web3"
    lang: typescript
    path: .
    registry: github-packages
```

## Convenção cross-repo (issues)

- Toda issue aberta neste repo **a pedido de outro repo do workspace** carrega `Blocks <owner/repo>#N` no corpo, apontando para a issue solicitante.
- Ao **fechar** uma issue com `Blocks`, quem fecha posta o veredito resumido como comment na issue solicitante (`<owner/repo>#N`), com footer `— 🤖 <modelo>`. Fechar sem avisar deixa o `Blocked by` do outro lado mentindo.
