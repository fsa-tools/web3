# @fsa/web3

Shared Web3 utilities para bots DeFi do portfólio: viem clients, ERC20 helpers, wrappers de Uniswap V3, Aerodrome e Aave V3.

## Install

```bash
npm install @fsa/web3
```

Requer `.npmrc` apontando pro Verdaccio interno:

```
@fsa:registry=http://avell.local:4873
```

## Uso

```ts
import { createClients, ensureAllowance, uniswapV3 } from "@fsa/web3";

const { publicClient, walletClient } = createClients({
  chainId: 8453,
  rpcUrl: process.env.BASE_RPC!,
  privateKey: process.env.PK as `0x${string}`,
});
```

## Scripts

- `npm run build` — compila TypeScript
- `npm test` — unit tests
- `npm run test:smoke` — smoke tests contra testnet (requer `.env`)

## Recovery history

v1.7.1 é uma reconstrução completa do source tree a partir do `dist/` compilado de v1.7.0, após perda do repositório local durante um `mv` sem backup. Ver `docs/superpowers/specs/2026-04-18-fsa-web3-reconstruction-design.md`.

## Segurança

Ver `SECURITY.md` para known issues em v1.7.x.
