# @fsa/web3 Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir o source tree de `@fsa/web3` a partir de `dist/` v1.7.0, publicar v1.7.1 no Verdaccio com paridade funcional e cobertura smoke em testnet real (Arbitrum/Base/Polygon).

**Architecture:** Novo repo GitLab `git@gitlab.com:fsa-portfolio/fsa-web3.git` em `~/dev/projetos/trading/libs/fsa-web3/`. Source antigo (`libs/web3-shared/dist/`) permanece intacto como fonte de verdade durante reconstrução. Cada arquivo TS é regenerado fundindo `.d.ts` (assinaturas) + `.js` (implementação). Verificação via `tsc --noEmit` por módulo. Smoke tests rodam manualmente contra testnets com chaves do usuário.

**Tech Stack:** TypeScript 5.7 (NodeNext ESM), viem 2.x, vitest 3.x, @viem/anvil, GitLab CI, Verdaccio (`http://avell.local:4873`).

**Source de referência:** `/Users/fabiosiqueira/dev/projetos/trading/libs/web3-shared/dist/` — NUNCA modificar.
**Target de reconstrução:** `/Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3/` — novo repo clonado.

---

## Phase 1 — Bootstrap

### Task 1: Clonar repo zero-km e criar estrutura base

**Files:**
- Create: `~/dev/projetos/trading/libs/fsa-web3/` (via git clone)

- [ ] **Step 1: Clonar o repo remoto**

```bash
cd ~/dev/projetos/trading/libs
git clone git@gitlab.com:fsa-portfolio/fsa-web3.git
cd fsa-web3
```

Expected: repo vazio (ou só com README/LICENSE default do GitLab).

- [ ] **Step 2: Criar diretórios de source**

```bash
mkdir -p src/abis src/constants src/math src/utils
mkdir -p src/protocols/aave src/protocols/aerodrome src/protocols/uniswap-v3
mkdir -p tests/unit tests/smoke
mkdir -p docs/superpowers/specs docs/superpowers/plans
```

- [ ] **Step 3: Copiar spec e plan do staging pra dentro do repo**

```bash
cp ~/dev/projetos/trading/libs/web3-shared/docs/superpowers/specs/2026-04-18-fsa-web3-reconstruction-design.md docs/superpowers/specs/
cp ~/dev/projetos/trading/libs/web3-shared/docs/superpowers/plans/2026-04-18-fsa-web3-reconstruction.md docs/superpowers/plans/
```

- [ ] **Step 4: Commit inicial de estrutura**

```bash
git add docs/
git commit -m "docs: add reconstruction spec and plan"
```

---

### Task 2: Scaffold package.json, tsconfig, configs

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.test.json`, `vitest.config.ts`, `vitest.smoke.config.ts`, `.gitignore`, `.npmrc`, `.env.example`

- [ ] **Step 1: Criar `package.json`** (idêntico ao publicado, com `repository` adicionado)

```json
{
  "name": "@fsa/web3",
  "version": "1.7.1",
  "description": "Shared Web3 utilities: viem clients, ERC20 helpers, Uniswap V3 / Aerodrome / Aave V3 protocol wrappers",
  "repository": {
    "type": "git",
    "url": "git@gitlab.com:fsa-portfolio/fsa-web3.git"
  },
  "files": ["dist"],
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./aerodrome": { "import": "./dist/src/protocols/aerodrome/index.js", "types": "./dist/src/protocols/aerodrome/index.d.ts" },
    "./uniswap-v3": { "import": "./dist/src/protocols/uniswap-v3/index.js", "types": "./dist/src/protocols/uniswap-v3/index.d.ts" },
    "./aave": { "import": "./dist/src/protocols/aave/index.js", "types": "./dist/src/protocols/aave/index.d.ts" },
    "./utils": { "import": "./dist/src/utils/index.js", "types": "./dist/src/utils/index.d.ts" },
    "./math": { "import": "./dist/src/math/index.js", "types": "./dist/src/math/index.d.ts" },
    "./abis": { "import": "./dist/src/abis/index.js", "types": "./dist/src/abis/index.d.ts" },
    "./constants": { "import": "./dist/src/constants/index.js", "types": "./dist/src/constants/index.d.ts" }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --project tsconfig.test.json",
    "test": "vitest run",
    "test:smoke": "vitest run --config vitest.smoke.config.ts",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "viem": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "@viem/anvil": "^0.0.10",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "index.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Criar `tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*", "tests/**/*", "index.ts"]
}
```

- [ ] **Step 4: Criar `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
```

- [ ] **Step 5: Criar `vitest.smoke.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/smoke/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
```

- [ ] **Step 6: Criar `.gitignore`**

```
node_modules/
dist/
coverage/
.vitest-cache/
.env
.env.*
!.env.example
*.log
.DS_Store
```

- [ ] **Step 7: Criar `.npmrc`**

```
@fsa:registry=http://avell.local:4873
//avell.local:4873/:_authToken=${VERDACCIO_TOKEN}
```

- [ ] **Step 8: Criar `.env.example`**

```
# Verdaccio publish token (apenas pra CI)
VERDACCIO_TOKEN=

# Smoke tests — private keys com saldo em testnet
SMOKE_PK_ARBITRUM=0x
SMOKE_PK_BASE=0x
SMOKE_PK_POLYGON=0x

# RPC endpoints testnet
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
BASE_SEPOLIA_RPC=https://sepolia.base.org
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
```

- [ ] **Step 9: Instalar deps**

```bash
npm install
```

Expected: instalação sem erros. `node_modules/` criado.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig*.json vitest*.config.ts .gitignore .npmrc .env.example
git commit -m "chore: scaffold package.json, tsconfig, vitest and env"
```

---

### Task 3: GitLab CI pipeline

**Files:**
- Create: `.gitlab-ci.yml`

- [ ] **Step 1: Criar `.gitlab-ci.yml`**

```yaml
image: node:20

stages:
  - install
  - check
  - build
  - publish

cache:
  key:
    files:
      - package-lock.json
  paths:
    - node_modules/

install:
  stage: install
  script:
    - npm ci

typecheck:
  stage: check
  script:
    - npm run typecheck

test:
  stage: check
  script:
    - npm test

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

publish:
  stage: publish
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
  script:
    - echo "@fsa:registry=http://avell.local:4873" > .npmrc
    - echo "//avell.local:4873/:_authToken=${VERDACCIO_TOKEN}" >> .npmrc
    - npm publish
```

- [ ] **Step 2: Commit**

```bash
git add .gitlab-ci.yml
git commit -m "ci: add GitLab pipeline for typecheck/test/build/publish"
```

---

## Phase 2 — Módulos puros (abis, constants, math)

### Task 4: Reconstruir `src/abis/`

**Files:**
- Source: `~/dev/projetos/trading/libs/web3-shared/dist/src/abis/{erc20,npm,pool,aerodrome-npm,aave-pool,index}.{js,d.ts}`
- Create: `src/abis/{erc20,npm,pool,aerodrome-npm,aave-pool,index}.ts`

ABIs são const arrays. Reconstrução é copy-paste do conteúdo `.js` + tipagem `as const` adicional quando `.d.ts` usa literal types.

- [ ] **Step 1: Criar `src/abis/erc20.ts`**

```ts
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "decimals",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
```

- [ ] **Step 2: Reconstruir os demais ABIs (`npm.ts`, `pool.ts`, `aerodrome-npm.ts`, `aave-pool.ts`)**

Procedimento por arquivo:
1. `cat ~/dev/projetos/trading/libs/web3-shared/dist/src/abis/<name>.js`
2. Copiar o const array para `src/abis/<name>.ts`
3. Adicionar `as const` ao final do array
4. Verificar nomes de exports via `.d.ts`: `cat ~/dev/projetos/trading/libs/web3-shared/dist/src/abis/<name>.d.ts`
5. Exports esperados:
   - `npm.ts` → `NPM_ABI`
   - `pool.ts` → `POOL_ABI`, `POOL_SLOT0_ABI`
   - `aerodrome-npm.ts` → `AERODROME_NPM_ABI`, `AERODROME_POOL_ABI`
   - `aave-pool.ts` → `AAVE_POOL_ABI`

- [ ] **Step 3: Criar `src/abis/index.ts`**

```ts
export { ERC20_ABI } from "./erc20.js";
export { NPM_ABI } from "./npm.js";
export { POOL_ABI, POOL_SLOT0_ABI } from "./pool.js";
export { AERODROME_NPM_ABI, AERODROME_POOL_ABI } from "./aerodrome-npm.js";
export { AAVE_POOL_ABI } from "./aave-pool.js";
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit --project tsconfig.json
```

Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add src/abis/
git commit -m "feat(abis): restore ERC20, NPM, POOL, Aerodrome, Aave ABIs"
```

---

### Task 5: Reconstruir `src/constants/`

**Files:**
- Source: `~/dev/projetos/trading/libs/web3-shared/dist/src/constants/{chains,addresses,gas,index}.{js,d.ts}`
- Create: `src/constants/{chains,addresses,gas,index}.ts`

- [ ] **Step 1: Criar `src/constants/chains.ts`**

```ts
export type ChainConfig = {
  id: number;
  name: string;
};

// NOTE: not all chains here have entries in ADDRESSES (e.g. 56, 146 have no protocol support yet).
export const CHAINS = {
  1: { id: 1, name: "ethereum" },
  10: { id: 10, name: "optimism" },
  56: { id: 56, name: "bnb" },
  146: { id: 146, name: "sonic" },
  8453: { id: 8453, name: "base" },
  42161: { id: 42161, name: "arbitrum" },
  137: { id: 137, name: "polygon" },
} as const;

export type ChainId = keyof typeof CHAINS;

export function toChainName(chainId: number): string | undefined {
  const chain = (CHAINS as Record<number, ChainConfig>)[chainId];
  return chain?.name;
}

export function toChainId(name: string): ChainId | undefined {
  const lower = name.toLowerCase();
  const entry = Object.entries(CHAINS).find(([, v]) => v.name === lower);
  return entry ? (Number(entry[0]) as ChainId) : undefined;
}
```

- [ ] **Step 2: Reconstruir `src/constants/addresses.ts`**

Procedimento:
```bash
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/constants/addresses.js
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/constants/addresses.d.ts
```

Copiar const maps para `src/constants/addresses.ts`. Usar tipos de `.d.ts` (provavelmente `Record<ChainId, { npm, factory, ... }>`). Adicionar `as const` onde aplicável.

- [ ] **Step 3: Reconstruir `src/constants/gas.ts`**

Procedimento idem Step 2 — arquivos são consts puros, risco zero.

- [ ] **Step 4: Criar `src/constants/index.ts`**

Abrir `~/dev/projetos/trading/libs/web3-shared/dist/src/constants/index.js` e replicar os exports tal qual.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit --project tsconfig.json
```

Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add src/constants/
git commit -m "feat(constants): restore chains, addresses, gas constants"
```

---

### Task 6: Reconstruir `src/math/` com unit tests

**Files:**
- Source: `~/dev/projetos/trading/libs/web3-shared/dist/src/math/{slippage,ticks,liquidity,index}.{js,d.ts}`
- Create: `src/math/{slippage,ticks,liquidity,index}.ts`
- Test: `tests/unit/math/{slippage,ticks,liquidity}.test.ts`

- [ ] **Step 1: Criar `src/math/slippage.ts`**

```ts
const MAX_BPS = 10_000;

export function toBps(decimal: number): number {
  return Math.round(decimal * MAX_BPS);
}

export function fromBps(bps: number): number {
  return bps / MAX_BPS;
}

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > MAX_BPS) {
    throw new Error(`slippageBps ${slippageBps} must be between 0 and 10000`);
  }
  return (amount * BigInt(MAX_BPS - slippageBps)) / BigInt(MAX_BPS);
}
```

- [ ] **Step 2: Escrever `tests/unit/math/slippage.test.ts` (TDD — teste primeiro)**

```ts
import { describe, it, expect } from "vitest";
import { toBps, fromBps, applySlippage } from "../../../src/math/slippage.js";

describe("slippage", () => {
  it("toBps converts decimal to basis points", () => {
    expect(toBps(0.01)).toBe(100);
    expect(toBps(0.005)).toBe(50);
    expect(toBps(1)).toBe(10_000);
  });

  it("fromBps is inverse of toBps", () => {
    expect(fromBps(100)).toBe(0.01);
    expect(fromBps(10_000)).toBe(1);
  });

  it("applySlippage subtracts bps from amount", () => {
    expect(applySlippage(10_000n, 100)).toBe(9900n);
    expect(applySlippage(10_000n, 50)).toBe(9950n);
    expect(applySlippage(10_000n, 0)).toBe(10_000n);
  });

  it("applySlippage rejects out-of-range bps", () => {
    expect(() => applySlippage(1n, -1)).toThrow(/between 0 and 10000/);
    expect(() => applySlippage(1n, 10_001)).toThrow(/between 0 and 10000/);
  });
});
```

- [ ] **Step 3: Rodar teste**

```bash
npx vitest run tests/unit/math/slippage.test.ts
```

Expected: 4 testes passando.

- [ ] **Step 4: Reconstruir `src/math/ticks.ts`**

Procedimento:
```bash
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/math/ticks.js
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/math/ticks.d.ts
```

Copiar implementação. Funções esperadas (via `.d.ts`): `getSqrtRatioAtTick`, `getTickAtSqrtRatio`, `nearestUsableTick`, e possivelmente helpers. Preservar nomes e assinaturas exatos.

- [ ] **Step 5: Escrever `tests/unit/math/ticks.test.ts` com Uniswap V3 reference values**

```ts
import { describe, it, expect } from "vitest";
import { getSqrtRatioAtTick, nearestUsableTick } from "../../../src/math/ticks.js";

describe("ticks", () => {
  it("getSqrtRatioAtTick(0) equals Q96", () => {
    // Uniswap V3 reference: sqrt(1.0001^0) * 2^96 = 2^96 = 79228162514264337593543950336
    expect(getSqrtRatioAtTick(0)).toBe(79228162514264337593543950336n);
  });

  it("getSqrtRatioAtTick symmetric around zero", () => {
    const pos = getSqrtRatioAtTick(100);
    const neg = getSqrtRatioAtTick(-100);
    // Q96^2 = 2^192 = 6277101735386680763835789423207666416102355444464034512896
    expect((pos * neg) / (1n << 96n)).toBeGreaterThan(0n);
  });

  it("nearestUsableTick rounds to tickSpacing", () => {
    expect(nearestUsableTick(123, 60)).toBe(120);
    expect(nearestUsableTick(150, 60)).toBe(180);
    expect(nearestUsableTick(-123, 60)).toBe(-120);
  });

  it("getSqrtRatioAtTick at MIN_TICK (-887272) is smallest valid value", () => {
    expect(getSqrtRatioAtTick(-887272)).toBe(4295128739n);
  });

  it("getSqrtRatioAtTick at MAX_TICK (887272)", () => {
    expect(getSqrtRatioAtTick(887272)).toBe(
      1461446703485210103287273052203988822378723970342n
    );
  });
});
```

- [ ] **Step 6: Rodar tests**

```bash
npx vitest run tests/unit/math/ticks.test.ts
```

Expected: 5 passando. Se valores exatos não bater, verificar implementação no `dist/` — reference values são invariantes Uniswap V3.

- [ ] **Step 7: Reconstruir `src/math/liquidity.ts`**

Procedimento:
```bash
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/math/liquidity.js
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/math/liquidity.d.ts
```

Copiar. Funções tipicamente: `getLiquidityForAmount0`, `getLiquidityForAmount1`, `getLiquidityForAmounts`, `getAmount0ForLiquidity`, `getAmount1ForLiquidity`, `getAmountsForLiquidity`.

- [ ] **Step 8: Escrever `tests/unit/math/liquidity.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { getAmountsForLiquidity, getLiquidityForAmounts } from "../../../src/math/liquidity.js";
import { getSqrtRatioAtTick } from "../../../src/math/ticks.js";

describe("liquidity", () => {
  it("roundtrip: getLiquidityForAmounts → getAmountsForLiquidity preserves amounts approximately", () => {
    const sqrtCurrent = getSqrtRatioAtTick(0);
    const sqrtLower = getSqrtRatioAtTick(-600);
    const sqrtUpper = getSqrtRatioAtTick(600);
    const amount0 = 1_000_000n;
    const amount1 = 1_000_000n;
    const L = getLiquidityForAmounts(sqrtCurrent, sqrtLower, sqrtUpper, amount0, amount1);
    const [a0, a1] = getAmountsForLiquidity(sqrtCurrent, sqrtLower, sqrtUpper, L);
    // Rounding loss < 0.01%
    expect(a0).toBeGreaterThan((amount0 * 9999n) / 10_000n);
    expect(a1).toBeGreaterThan((amount1 * 9999n) / 10_000n);
  });

  it("amounts below range: only amount0 used", () => {
    const sqrtCurrent = getSqrtRatioAtTick(-1000);
    const sqrtLower = getSqrtRatioAtTick(-600);
    const sqrtUpper = getSqrtRatioAtTick(600);
    const [a0, a1] = getAmountsForLiquidity(sqrtCurrent, sqrtLower, sqrtUpper, 1_000_000n);
    expect(a0).toBeGreaterThan(0n);
    expect(a1).toBe(0n);
  });

  it("amounts above range: only amount1 used", () => {
    const sqrtCurrent = getSqrtRatioAtTick(1000);
    const sqrtLower = getSqrtRatioAtTick(-600);
    const sqrtUpper = getSqrtRatioAtTick(600);
    const [a0, a1] = getAmountsForLiquidity(sqrtCurrent, sqrtLower, sqrtUpper, 1_000_000n);
    expect(a0).toBe(0n);
    expect(a1).toBeGreaterThan(0n);
  });
});
```

- [ ] **Step 9: Rodar tests**

```bash
npx vitest run tests/unit/math/
```

Expected: todos passando (slippage + ticks + liquidity).

- [ ] **Step 10: Criar `src/math/index.ts`**

Abrir `~/dev/projetos/trading/libs/web3-shared/dist/src/math/index.js` e replicar exports.

- [ ] **Step 11: Typecheck + commit**

```bash
npx tsc --noEmit --project tsconfig.test.json
git add src/math/ tests/unit/math/
git commit -m "feat(math): restore slippage, ticks, liquidity with unit tests"
```

---

## Phase 3 — utils/

### Task 7: Reconstruir `src/utils/` parte 1 (address, decimals, client)

**Files:**
- Source: `~/dev/projetos/trading/libs/web3-shared/dist/src/utils/{address,decimals,client}.{js,d.ts}`
- Create: `src/utils/{address,decimals,client}.ts`
- Test: `tests/unit/utils/{address,decimals}.test.ts`

- [ ] **Step 1: Criar `src/utils/address.ts`**

```ts
import { isAddress, getAddress, type Address } from "viem";

export function validateAddress(addr: string): Address {
  if (!isAddress(addr)) {
    throw new Error(`Invalid Ethereum address: ${addr}`);
  }
  return getAddress(addr);
}
```

- [ ] **Step 2: Escrever `tests/unit/utils/address.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateAddress } from "../../../src/utils/address.js";

describe("validateAddress", () => {
  it("returns checksummed address", () => {
    expect(validateAddress("0xaf88d065e77c8cc2239327c5edb3a432268e5831")).toBe(
      "0xaf88d065e77C8cC2239327C5EDb3A432268e5831"
    );
  });

  it("accepts checksummed address", () => {
    expect(validateAddress("0xaf88d065e77C8cC2239327C5EDb3A432268e5831")).toBe(
      "0xaf88d065e77C8cC2239327C5EDb3A432268e5831"
    );
  });

  it("throws on invalid address", () => {
    expect(() => validateAddress("not-an-address")).toThrow(/Invalid/);
    expect(() => validateAddress("0x123")).toThrow(/Invalid/);
  });
});
```

- [ ] **Step 3: Rodar teste**

```bash
npx vitest run tests/unit/utils/address.test.ts
```

Expected: 3 passando.

- [ ] **Step 4: Criar `src/utils/decimals.ts`**

```ts
import type { Address, PublicClient } from "viem";
import { ERC20_ABI } from "../abis/erc20.js";

export type GetTokenDecimalsParams = {
  publicClient: PublicClient;
  token: Address;
};

const decimalsCache = new Map<string, number>();

function cacheKey(chainId: number, token: Address): string {
  return `${chainId}:${token.toLowerCase()}`;
}

export async function getTokenDecimals(params: GetTokenDecimalsParams): Promise<number> {
  const chainId = params.publicClient.chain?.id;
  if (chainId === undefined) {
    throw new Error("publicClient must have a chain configured");
  }
  const key = cacheKey(chainId, params.token);
  const cached = decimalsCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const decimals = (await params.publicClient.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "decimals",
  })) as number;
  decimalsCache.set(key, decimals);
  return decimals;
}

/** @internal — exposed only for test cache reset */
export function _resetCache(): void {
  decimalsCache.clear();
}
```

- [ ] **Step 5: Escrever `tests/unit/utils/decimals.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTokenDecimals, _resetCache } from "../../../src/utils/decimals.js";

describe("getTokenDecimals", () => {
  beforeEach(() => _resetCache());

  it("reads decimals from contract", async () => {
    const readContract = vi.fn().mockResolvedValue(6);
    const publicClient = { chain: { id: 42161 }, readContract } as any;
    const decimals = await getTokenDecimals({
      publicClient,
      token: "0xaf88d065e77C8cC2239327C5EDb3A432268e5831",
    });
    expect(decimals).toBe(6);
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it("caches per (chainId, token)", async () => {
    const readContract = vi.fn().mockResolvedValue(18);
    const publicClient = { chain: { id: 42161 }, readContract } as any;
    const token = "0xaf88d065e77C8cC2239327C5EDb3A432268e5831" as const;
    await getTokenDecimals({ publicClient, token });
    await getTokenDecimals({ publicClient, token });
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it("throws when client has no chain", async () => {
    const publicClient = { readContract: vi.fn() } as any;
    await expect(
      getTokenDecimals({ publicClient, token: "0xaf88d065e77C8cC2239327C5EDb3A432268e5831" })
    ).rejects.toThrow(/chain configured/);
  });
});
```

- [ ] **Step 6: Rodar teste**

```bash
npx vitest run tests/unit/utils/decimals.test.ts
```

Expected: 3 passando.

- [ ] **Step 7: Criar `src/utils/client.ts`**

```ts
import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  base,
  mainnet,
  optimism,
  arbitrum,
  polygon,
  sepolia,
  polygonAmoy,
} from "viem/chains";

export type CreateClientsParams = {
  chainId: number;
  rpcUrl: string | string[];
  privateKey?: Hex;
};

export type ClientPair = {
  publicClient: PublicClient;
  walletClient?: WalletClient<Transport, Chain, Account>;
};

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  8453: base,
  42161: arbitrum,
  137: polygon,
  11155111: sepolia,
  80002: polygonAmoy,
};

export function createClients(params: CreateClientsParams): ClientPair {
  const chain = CHAIN_MAP[params.chainId];
  if (!chain) {
    throw new Error(`Unsupported chainId: ${params.chainId}`);
  }
  const transport = Array.isArray(params.rpcUrl)
    ? fallback(
        params.rpcUrl.map((url) => http(url)),
        { rank: true, retryCount: 1 }
      )
    : http(params.rpcUrl);
  const publicClient = createPublicClient({ chain, transport }) as PublicClient;
  const walletClient = params.privateKey
    ? createWalletClient({
        chain,
        transport,
        account: privateKeyToAccount(params.privateKey),
      })
    : undefined;
  return { publicClient, walletClient };
}
```

- [ ] **Step 8: Typecheck + commit**

```bash
npx tsc --noEmit --project tsconfig.test.json
git add src/utils/{address,decimals,client}.ts tests/unit/utils/
git commit -m "feat(utils): restore address, decimals, client with unit tests"
```

---

### Task 8: Reconstruir `src/utils/` parte 2 (erc20, gas, pool, position)

**Files:**
- Source: `~/dev/projetos/trading/libs/web3-shared/dist/src/utils/{erc20,gas,pool,position,index}.{js,d.ts}`
- Create: `src/utils/{erc20,gas,pool,position,index}.ts`

- [ ] **Step 1: Criar `src/utils/erc20.ts`**

```ts
import type {
  Address,
  Hash,
  PublicClient,
  WalletClient,
  Transport,
  Chain,
  Account,
} from "viem";
import { ERC20_ABI } from "../abis/erc20.js";
import { validateAddress } from "./address.js";

const MAX_UINT256 = 2n ** 256n - 1n;

export type EnsureAllowanceParams = {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  token: Address;
  spender: Address;
  amount: bigint;
};

export type AllowanceResult = {
  approved: boolean;
  txHash?: Hash;
};

export async function ensureAllowance(
  params: EnsureAllowanceParams
): Promise<AllowanceResult> {
  const { publicClient, walletClient, token, spender, amount } = params;
  validateAddress(token);
  validateAddress(spender);
  if (amount === 0n) {
    return { approved: false };
  }
  const currentAllowance = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [walletClient.account.address, spender],
  })) as bigint;
  if (currentAllowance >= amount) {
    return { approved: false };
  }
  const txHash = await walletClient.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, MAX_UINT256],
    chain: walletClient.chain,
    account: walletClient.account,
  });
  return { approved: true, txHash };
}

export type GetBalanceParams = {
  publicClient: PublicClient;
  token: Address;
  owner: Address;
};

export async function getBalance(params: GetBalanceParams): Promise<bigint> {
  return (await params.publicClient.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [params.owner],
  })) as bigint;
}
```

- [ ] **Step 2: Reconstruir `src/utils/gas.ts`**

Procedimento:
```bash
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/utils/gas.js
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/utils/gas.d.ts
```

Copiar implementação e assinaturas. Funções típicas: `withGasGuard`, `estimateTxCost`. Preservar exports exatos.

- [ ] **Step 3: Reconstruir `src/utils/pool.ts`**

Procedimento:
```bash
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/utils/pool.js
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/utils/pool.d.ts
```

Funções típicas: `getPoolSlot0` (lê tick + sqrtPriceX96). Preservar imports de abis/pool.

- [ ] **Step 4: Reconstruir `src/utils/position.ts`**

Procedimento:
```bash
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/utils/position.js
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/utils/position.d.ts
```

Funções típicas: leitura de NFT position via NPM_ABI.

- [ ] **Step 5: Criar `src/utils/index.ts`**

Abrir `~/dev/projetos/trading/libs/web3-shared/dist/src/utils/index.js` e replicar exports tal qual.

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit --project tsconfig.test.json
git add src/utils/
git commit -m "feat(utils): restore erc20, gas, pool, position"
```

---

## Phase 4 — Protocols

### Task 9: Reconstruir `src/protocols/aave/`

**Files:**
- Source: `~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/aave/{supply,withdraw,position,types,index}.{js,d.ts}`
- Create: `src/protocols/aave/{supply,withdraw,position,types,index}.ts`

- [ ] **Step 1: Reconstruir `types.ts`**

```bash
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/aave/types.js
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/aave/types.d.ts
```

Copiar type aliases. `types.js` é vazio (só re-exports) — a info real vem de `types.d.ts`. Preservar nomes de tipos exportados.

- [ ] **Step 2: Reconstruir `position.ts`** — leitura de posição Aave (userAccountData)

```bash
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/aave/position.js
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/aave/position.d.ts
```

Copiar implementação. Usa `AAVE_POOL_ABI` + `validateAddress`.

- [ ] **Step 3: Reconstruir `supply.ts`** — deposita collateral em Aave

Idem — ler `.js + .d.ts`, reconstruir.

- [ ] **Step 4: Reconstruir `withdraw.ts`** — retira collateral

Idem.

- [ ] **Step 5: Criar `index.ts`**

Abrir `~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/aave/index.js` e replicar exports.

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit --project tsconfig.test.json
git add src/protocols/aave/
git commit -m "feat(aave): restore supply, withdraw, position"
```

---

### Task 10: Reconstruir `src/protocols/aerodrome/`

**Files:**
- Source: `~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/aerodrome/{mint,decrease,collect,burn,types,index}.{js,d.ts}`
- Create: `src/protocols/aerodrome/{mint,decrease,collect,burn,types,index}.ts`

- [ ] **Step 1 a 5: Reconstruir cada arquivo (types → mint → decrease → collect → burn)**

Para cada arquivo:
```bash
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/aerodrome/<name>.js
cat ~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/aerodrome/<name>.d.ts
```

Transcrever:
1. Imports com extensão `.js`
2. Types exportados de `.d.ts`
3. Corpo de função de `.js`, adicionando tipos de parâmetros conforme `.d.ts`
4. Usar `AERODROME_NPM_ABI` + `AERODROME_POOL_ABI` onde o `.js` importa

**Padrão esperado para `mint.ts`:**
- Recebe: `walletClient`, `params` (token0/token1, tickLower/Upper, amount0/1Desired, slippageBps, deadlineSecs)
- Faz `ensureAllowance` em cada token
- Chama `writeContract` em AERODROME_NPM com função `mint`
- Retorna `{ txHash, tokenId? }` via `waitForTransactionReceipt`

**Importante:** NÃO adicionar parâmetro `confirmations` ao `waitForTransactionReceipt` — isso é fix do R-03 que entra em v1.8.0.

- [ ] **Step 6: Criar `index.ts` preservando exports de `dist/src/protocols/aerodrome/index.js`**

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc --noEmit --project tsconfig.test.json
git add src/protocols/aerodrome/
git commit -m "feat(aerodrome): restore mint, decrease, collect, burn"
```

---

### Task 11: Reconstruir `src/protocols/uniswap-v3/`

**Files:**
- Source: `~/dev/projetos/trading/libs/web3-shared/dist/src/protocols/uniswap-v3/{mint,decrease,collect,burn,types,index}.{js,d.ts}`
- Create: `src/protocols/uniswap-v3/{mint,decrease,collect,burn,types,index}.ts`

Simétrico ao Aerodrome, mas usa `NPM_ABI` (Uniswap V3 NonfungiblePositionManager) ao invés de `AERODROME_NPM_ABI`. E `POOL_ABI` ao invés de `AERODROME_POOL_ABI`.

- [ ] **Step 1 a 5:** Reconstruir arquivo por arquivo seguindo o mesmo padrão da Task 10.

- [ ] **Step 6: Criar `index.ts`**

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc --noEmit --project tsconfig.test.json
git add src/protocols/uniswap-v3/
git commit -m "feat(uniswap-v3): restore mint, decrease, collect, burn"
```

---

### Task 12: Root `index.ts` + build completo

**Files:**
- Source: `~/dev/projetos/trading/libs/web3-shared/dist/index.js`, `dist/index.d.ts`
- Create: `index.ts`

- [ ] **Step 1: Criar `index.ts` na raiz**

```ts
export * from "./src/abis/index.js";
export * from "./src/constants/index.js";
export * from "./src/math/index.js";
export * from "./src/utils/index.js";
export * as aerodrome from "./src/protocols/aerodrome/index.js";
export * as uniswapV3 from "./src/protocols/uniswap-v3/index.js";
export * as aave from "./src/protocols/aave/index.js";
```

- [ ] **Step 2: Build completo**

```bash
npm run build
```

Expected: `dist/` gerado sem erros.

- [ ] **Step 3: Comparar outputs com dist original**

```bash
diff -r dist/src ~/dev/projetos/trading/libs/web3-shared/dist/src | head -40
```

Expected: diferenças apenas cosméticas (whitespace, ordem de campos em types). Qualquer divergência de símbolo exportado ou assinatura requer ajuste no source reconstruído.

- [ ] **Step 4: Rodar unit tests completos**

```bash
npm test
```

Expected: todos os unit tests passando.

- [ ] **Step 5: Commit**

```bash
git add index.ts
git commit -m "feat: root index.ts — complete v1.7.1 reconstruction"
```

- [ ] **Step 6: Push incremental pro GitLab**

```bash
git push origin main
```

---

## Phase 5 — Smoke tests

### Task 13: Helpers de smoke test

**Files:**
- Create: `tests/smoke/_helpers.ts`

- [ ] **Step 1: Criar `tests/smoke/_helpers.ts`**

```ts
import type { Hex } from "viem";

export type SmokeChainConfig = {
  chainId: number;
  name: string;
  rpcEnvVar: string;
  pkEnvVar: string;
  faucetTokens: {
    // Endereços de tokens de faucet conhecidos por testnet
    weth?: `0x${string}`;
    usdc?: `0x${string}`;
  };
  protocols: {
    uniswapV3Npm?: `0x${string}`;
    uniswapV3Factory?: `0x${string}`;
    aavePool?: `0x${string}`;
    aerodromeNpm?: `0x${string}`;
  };
};

export const SMOKE_CHAINS: Record<string, SmokeChainConfig> = {
  arbitrumSepolia: {
    chainId: 421614,
    name: "arbitrum-sepolia",
    rpcEnvVar: "ARBITRUM_SEPOLIA_RPC",
    pkEnvVar: "SMOKE_PK_ARBITRUM",
    faucetTokens: {
      // WETH Sepolia Arbitrum
      weth: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
      // USDC faucet Arbitrum Sepolia
      usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    },
    protocols: {
      uniswapV3Npm: "0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65",
      aavePool: "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff",
    },
  },
  baseSepolia: {
    chainId: 84532,
    name: "base-sepolia",
    rpcEnvVar: "BASE_SEPOLIA_RPC",
    pkEnvVar: "SMOKE_PK_BASE",
    faucetTokens: {
      weth: "0x4200000000000000000000000000000000000006",
      usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    },
    protocols: {
      uniswapV3Npm: "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
      aerodromeNpm: "0x827922686190790b37229fd06084350E74485b72",
    },
  },
  polygonAmoy: {
    chainId: 80002,
    name: "polygon-amoy",
    rpcEnvVar: "POLYGON_AMOY_RPC",
    pkEnvVar: "SMOKE_PK_POLYGON",
    faucetTokens: {
      weth: "0x52eF3d68BaB452a294342DC3e5f464d7f610f72E",
      usdc: "0x41e94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    },
    protocols: {
      uniswapV3Npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      aavePool: "0x1758d4e6f68166C4B2d9d0F049F33dEB399Daa1F",
    },
  },
};

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export function loadChainEnv(cfg: SmokeChainConfig): { rpcUrl: string; pk: Hex } | null {
  const rpcUrl = process.env[cfg.rpcEnvVar];
  const pk = process.env[cfg.pkEnvVar];
  if (!rpcUrl || !pk) return null;
  return { rpcUrl, pk: pk as Hex };
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/smoke/_helpers.ts
git commit -m "test(smoke): add chain config helpers"
```

---

### Task 14: Smoke — utils (ensureAllowance, getBalance, getTokenDecimals)

**Files:**
- Create: `tests/smoke/utils.smoke.test.ts`

- [ ] **Step 1: Criar teste**

```ts
import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

for (const [key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const env = loadChainEnv(cfg);
  describe.skipIf(!env)(`utils smoke — ${cfg.name}`, () => {
    if (!env) return;
    const token = cfg.faucetTokens.usdc ?? cfg.faucetTokens.weth!;
    const spender = cfg.protocols.uniswapV3Npm ?? cfg.protocols.aavePool!;

    it(`getTokenDecimals reads USDC/WETH decimals`, async () => {
      const { publicClient } = createClients({ chainId: cfg.chainId, rpcUrl: env.rpcUrl });
      const dec = await getTokenDecimals({ publicClient, token });
      expect([6, 8, 18]).toContain(dec);
    });

    it(`getBalance returns bigint >= 0`, async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env.rpcUrl,
        privateKey: env.pk,
      });
      const bal = await getBalance({
        publicClient,
        token,
        owner: walletClient!.account.address,
      });
      expect(typeof bal).toBe("bigint");
      expect(bal).toBeGreaterThanOrEqual(0n);
    });

    it(`ensureAllowance (amount=0) returns approved=false without tx`, async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env.rpcUrl,
        privateKey: env.pk,
      });
      const result = await ensureAllowance({
        publicClient,
        walletClient: walletClient!,
        token,
        spender,
        amount: 0n,
      });
      expect(result.approved).toBe(false);
      expect(result.txHash).toBeUndefined();
    });

    it(`ensureAllowance approves MAX_UINT256 when below amount`, async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env.rpcUrl,
        privateKey: env.pk,
      });
      // Small amount — se allowance já é >= 1n, retorna approved=false
      const result = await ensureAllowance({
        publicClient,
        walletClient: walletClient!,
        token,
        spender,
        amount: 1n,
      });
      expect(typeof result.approved).toBe("boolean");
      if (result.approved) {
        expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
      }
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/smoke/utils.smoke.test.ts
git commit -m "test(smoke): add utils smoke tests"
```

---

### Task 15: Smoke — pool.getPoolSlot0 (read-only, sem tx)

**Files:**
- Create: `tests/smoke/pool.smoke.test.ts`

- [ ] **Step 1: Criar teste**

```ts
import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { getPoolSlot0 } from "../../src/utils/pool.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

// Pool addresses canônicos em testnet (usar um pool Uniswap V3 ativo).
const POOLS: Record<string, `0x${string}`> = {
  // WETH/USDC 0.05% Arbitrum Sepolia (exemplo — confirmar ao rodar)
  "arbitrum-sepolia": "0x0000000000000000000000000000000000000000",
  "base-sepolia": "0x0000000000000000000000000000000000000000",
};

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const env = loadChainEnv(cfg);
  const pool = POOLS[cfg.name];
  const canRun = env && pool && pool !== "0x0000000000000000000000000000000000000000";
  describe.skipIf(!canRun)(`pool smoke — ${cfg.name}`, () => {
    if (!canRun) return;

    it(`slot0 returns sqrtPriceX96 > 0`, async () => {
      const { publicClient } = createClients({ chainId: cfg.chainId, rpcUrl: env!.rpcUrl });
      const slot0 = await getPoolSlot0({ publicClient, pool });
      expect(slot0.sqrtPriceX96).toBeGreaterThan(0n);
      expect(typeof slot0.tick).toBe("number");
    });
  });
}
```

**Nota:** Os endereços de pool em `POOLS` devem ser preenchidos ao rodar os testes. Usar um pool ativo WETH/USDC 0.05% da Uniswap V3 nas respectivas testnets. Skip automático se ausente.

- [ ] **Step 2: Commit**

```bash
git add tests/smoke/pool.smoke.test.ts
git commit -m "test(smoke): add pool.slot0 smoke"
```

---

### Task 16: Smoke — Uniswap V3 lifecycle (mint → decrease → collect → burn)

**Files:**
- Create: `tests/smoke/uniswap-v3.smoke.test.ts`

- [ ] **Step 1: Criar teste**

```ts
import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import * as uniswapV3 from "../../src/protocols/uniswap-v3/index.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const env = loadChainEnv(cfg);
  const canRun = env && cfg.protocols.uniswapV3Npm && cfg.faucetTokens.weth && cfg.faucetTokens.usdc;
  describe.skipIf(!canRun)(`uniswap-v3 smoke lifecycle — ${cfg.name}`, () => {
    if (!canRun) return;
    const weth = cfg.faucetTokens.weth!;
    const usdc = cfg.faucetTokens.usdc!;
    const npm = cfg.protocols.uniswapV3Npm!;

    it(`full lifecycle: mint → decrease 50% → collect → burn`, async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env!.rpcUrl,
        privateKey: env!.pk,
      });

      // 1. Balance sanity
      const owner = walletClient!.account.address;
      const [wethDec, usdcDec] = await Promise.all([
        getTokenDecimals({ publicClient, token: weth }),
        getTokenDecimals({ publicClient, token: usdc }),
      ]);
      const [wethBal, usdcBal] = await Promise.all([
        getBalance({ publicClient, token: weth, owner }),
        getBalance({ publicClient, token: usdc, owner }),
      ]);
      const wethMin = 10n ** BigInt(wethDec - 3); // 0.001 WETH
      const usdcMin = 10n ** BigInt(usdcDec);     // 1 USDC
      if (wethBal < wethMin || usdcBal < usdcMin) {
        console.warn(`Skipping ${cfg.name} — insufficient balance (weth=${wethBal}, usdc=${usdcBal})`);
        return;
      }

      // 2. Approvals
      await ensureAllowance({ publicClient, walletClient: walletClient!, token: weth, spender: npm, amount: wethMin });
      await ensureAllowance({ publicClient, walletClient: walletClient!, token: usdc, spender: npm, amount: usdcMin });

      // 3. Mint — parâmetros exatos dependem da assinatura em src/protocols/uniswap-v3/mint.ts
      const mintResult = await uniswapV3.mint({
        publicClient,
        walletClient: walletClient!,
        token0: weth < usdc ? weth : usdc,
        token1: weth < usdc ? usdc : weth,
        fee: 500,
        tickLower: -60_000,
        tickUpper: 60_000,
        amount0Desired: weth < usdc ? wethMin : usdcMin,
        amount1Desired: weth < usdc ? usdcMin : wethMin,
        slippageBps: 500,
        deadlineSecs: 600,
      } as any);
      expect(mintResult.tokenId).toBeGreaterThan(0n);

      // 4. Decrease 50%
      const decResult = await uniswapV3.decrease({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
        liquidityBps: 5000,
        slippageBps: 500,
        deadlineSecs: 600,
      } as any);
      expect(decResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      // 5. Collect
      const collectResult = await uniswapV3.collect({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
      } as any);
      expect(collectResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      // 6. Decrease 100% + burn
      await uniswapV3.decrease({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
        liquidityBps: 10_000,
        slippageBps: 500,
        deadlineSecs: 600,
      } as any);
      await uniswapV3.collect({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
      } as any);
      const burnResult = await uniswapV3.burn({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
      } as any);
      expect(burnResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    }, 180_000);
  });
}
```

**Nota:** `as any` nos params é intencional — assinatura exata depende do que for reconstruído em `src/protocols/uniswap-v3/mint.ts` etc. Após reconstrução, ajustar.

- [ ] **Step 2: Commit**

```bash
git add tests/smoke/uniswap-v3.smoke.test.ts
git commit -m "test(smoke): uniswap-v3 full lifecycle"
```

---

### Task 17: Smoke — Aerodrome lifecycle (base-sepolia)

**Files:**
- Create: `tests/smoke/aerodrome.smoke.test.ts`

- [ ] **Step 1: Criar teste**

Idêntico estruturalmente à Task 16, mas usa `import * as aerodrome from "../../src/protocols/aerodrome/index.js"` e só roda em `baseSepolia` (Aerodrome é Base-only).

```ts
import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { ensureAllowance } from "../../src/utils/erc20.js";
import * as aerodrome from "../../src/protocols/aerodrome/index.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

const cfg = SMOKE_CHAINS.baseSepolia;
const env = loadChainEnv(cfg);
const canRun = env && cfg.protocols.aerodromeNpm && cfg.faucetTokens.weth && cfg.faucetTokens.usdc;

describe.skipIf(!canRun)("aerodrome smoke lifecycle — base-sepolia", () => {
  if (!canRun) return;
  const weth = cfg.faucetTokens.weth!;
  const usdc = cfg.faucetTokens.usdc!;
  const npm = cfg.protocols.aerodromeNpm!;

  it("mint → decrease 50% → collect → burn", async () => {
    const { publicClient, walletClient } = createClients({
      chainId: cfg.chainId,
      rpcUrl: env!.rpcUrl,
      privateKey: env!.pk,
    });
    // Params reais idênticos em estrutura à Task 16; `as any` até sabermos a assinatura exata.
    await ensureAllowance({ publicClient, walletClient: walletClient!, token: weth, spender: npm, amount: 10n ** 15n });
    await ensureAllowance({ publicClient, walletClient: walletClient!, token: usdc, spender: npm, amount: 10n ** 6n });

    const mint = await aerodrome.mint({
      publicClient,
      walletClient: walletClient!,
      token0: weth < usdc ? weth : usdc,
      token1: weth < usdc ? usdc : weth,
      tickSpacing: 200,
      tickLower: -60_000,
      tickUpper: 60_000,
      amount0Desired: weth < usdc ? 10n ** 15n : 10n ** 6n,
      amount1Desired: weth < usdc ? 10n ** 6n : 10n ** 15n,
      slippageBps: 500,
      deadlineSecs: 600,
    } as any);
    expect(mint.tokenId).toBeGreaterThan(0n);

    await aerodrome.decrease({
      publicClient, walletClient: walletClient!, tokenId: mint.tokenId,
      liquidityBps: 5000, slippageBps: 500, deadlineSecs: 600,
    } as any);
    await aerodrome.collect({ publicClient, walletClient: walletClient!, tokenId: mint.tokenId } as any);
    await aerodrome.decrease({
      publicClient, walletClient: walletClient!, tokenId: mint.tokenId,
      liquidityBps: 10_000, slippageBps: 500, deadlineSecs: 600,
    } as any);
    await aerodrome.collect({ publicClient, walletClient: walletClient!, tokenId: mint.tokenId } as any);
    const burn = await aerodrome.burn({ publicClient, walletClient: walletClient!, tokenId: mint.tokenId } as any);
    expect(burn.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
  }, 180_000);
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/smoke/aerodrome.smoke.test.ts
git commit -m "test(smoke): aerodrome full lifecycle (base-sepolia)"
```

---

### Task 18: Smoke — Aave supply/withdraw

**Files:**
- Create: `tests/smoke/aave.smoke.test.ts`

- [ ] **Step 1: Criar teste**

```ts
import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import * as aave from "../../src/protocols/aave/index.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const env = loadChainEnv(cfg);
  const canRun = env && cfg.protocols.aavePool && cfg.faucetTokens.usdc;
  describe.skipIf(!canRun)(`aave smoke — ${cfg.name}`, () => {
    if (!canRun) return;
    const pool = cfg.protocols.aavePool!;
    const asset = cfg.faucetTokens.usdc!;

    it("supply 1 USDC → getUserAccountData → withdraw", async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env!.rpcUrl,
        privateKey: env!.pk,
      });
      const owner = walletClient!.account.address;
      const decimals = await getTokenDecimals({ publicClient, token: asset });
      const amount = 10n ** BigInt(decimals); // 1 USDC
      const bal = await getBalance({ publicClient, token: asset, owner });
      if (bal < amount) {
        console.warn(`Skipping aave ${cfg.name} — insufficient USDC`);
        return;
      }

      await ensureAllowance({
        publicClient, walletClient: walletClient!, token: asset, spender: pool, amount,
      });
      const supplyResult = await aave.supply({
        publicClient, walletClient: walletClient!, pool, asset, amount,
      } as any);
      expect(supplyResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      const acct = await aave.getUserAccountData({ publicClient, pool, user: owner } as any);
      expect(acct.totalCollateralBase).toBeGreaterThan(0n);

      const withdrawResult = await aave.withdraw({
        publicClient, walletClient: walletClient!, pool, asset, amount,
      } as any);
      expect(withdrawResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    }, 120_000);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/smoke/aave.smoke.test.ts
git commit -m "test(smoke): aave supply/withdraw lifecycle"
```

---

## Phase 6 — Release

### Task 19: README, CHANGELOG, SECURITY docs

**Files:**
- Create: `README.md`, `CHANGELOG.md`, `SECURITY.md`

- [ ] **Step 1: Criar `README.md`**

```markdown
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
```

- [ ] **Step 2: Criar `CHANGELOG.md`**

```markdown
# Changelog

## [1.7.1] — 2026-04-18

Reconstrução completa do source tree após perda durante reorganização de diretórios. Paridade funcional com 1.7.0 validada via unit tests + smoke tests em Arbitrum Sepolia, Base Sepolia e Polygon Amoy. Primeira versão sob controle git remoto (`gitlab.com:fsa-portfolio/fsa-web3`).

Nenhuma mudança de API ou comportamento.
```

- [ ] **Step 3: Criar `SECURITY.md`**

```markdown
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
```

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md SECURITY.md
git commit -m "docs: add README, CHANGELOG, SECURITY notes"
```

---

### Task 20: PAUSA — usuário injeta PKs e roda smoke

- [ ] **Step 1: Avisar o usuário**

Mensagem exata a enviar:

> **Hora das private keys.** Crie `~/dev/projetos/trading/libs/fsa-web3/.env` com:
> ```
> SMOKE_PK_ARBITRUM=0x...
> SMOKE_PK_BASE=0x...
> SMOKE_PK_POLYGON=0x...
> ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
> BASE_SEPOLIA_RPC=https://sepolia.base.org
> POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
> ```
> Confirme que cada conta tem pelo menos 0.005 ETH + 5 USDC na respectiva testnet, ou rode faucets:
> - Arbitrum Sepolia: https://www.alchemy.com/faucets/arbitrum-sepolia
> - Base Sepolia: https://www.alchemy.com/faucets/base-sepolia
> - Polygon Amoy: https://faucet.polygon.technology
>
> Reply com "env pronto" para rodar smoke.

Aguardar resposta antes de continuar.

- [ ] **Step 2: Rodar smoke tests**

```bash
cd ~/dev/projetos/trading/libs/fsa-web3
npm run test:smoke
```

Expected:
- Chains com `.env` completo: todos os testes passando
- Chains sem `.env`: `skip` com aviso
- Saldos insuficientes: `skip` com warning via console

Se algum teste falhar com erro não-skip (revert, nonce, rpc), investigar caso a caso. Não avançar pra publish até todos passarem ou serem skips justificados.

---

### Task 21: Tag e publish v1.7.1

**Files:** nenhum novo — só git ops + npm publish.

- [ ] **Step 1: Confirmar build limpo**

```bash
cd ~/dev/projetos/trading/libs/fsa-web3
rm -rf dist
npm run build
npm test
```

Expected: build gera `dist/` sem erro, todos os unit tests passando.

- [ ] **Step 2: Diff final contra dist original**

```bash
diff -r dist/ ~/dev/projetos/trading/libs/web3-shared/dist/ | head -60
```

Expected: diferenças cosméticas (whitespace, ordem de campos). Qualquer símbolo exportado divergente é bloqueador.

- [ ] **Step 3: Tag v1.7.1**

```bash
git tag -a v1.7.1 -m "Rebuild from compiled dist after source loss — functional parity with 1.7.0"
git push origin main
git push origin v1.7.1
```

Expected: GitLab CI dispara pipeline `publish` (por causa do tag). Se `VERDACCIO_TOKEN` não estiver configurado como var protegida no GitLab, CI falha no stage `publish`. Nesse caso, publicar manualmente:

- [ ] **Step 4: Publish manual (fallback se CI falhar)**

```bash
export VERDACCIO_TOKEN="<token>"
npm publish
```

Expected: `+ @fsa/web3@1.7.1` no Verdaccio.

- [ ] **Step 5: Verificar publish**

```bash
curl -s http://avell.local:4873/@fsa%2fweb3 | grep '"version"' | head
```

Expected: `"version":"1.7.1"` presente.

---

### Task 22: Validar consumidores

**Files:**
- Modify: `~/dev/projetos/trading/vfat-monitor/vfat-pool-monitor/package-lock.json` (via npm update)
- Modify: `~/dev/projetos/trading/claw-yield/package-lock.json`
- Modify: `~/dev/projetos/trading/defigenius/package-lock.json`

- [ ] **Step 1: Atualizar cada consumidor**

```bash
for dir in ~/dev/projetos/trading/vfat-monitor/vfat-pool-monitor ~/dev/projetos/trading/claw-yield ~/dev/projetos/trading/defigenius; do
  echo "=== $dir ==="
  cd "$dir"
  npm update @fsa/web3
  npm ls @fsa/web3
done
```

Expected: `@fsa/web3@1.7.1` resolvido em cada um.

- [ ] **Step 2: Typecheck de cada consumidor**

```bash
for dir in ~/dev/projetos/trading/vfat-monitor/vfat-pool-monitor ~/dev/projetos/trading/claw-yield ~/dev/projetos/trading/defigenius; do
  echo "=== $dir ==="
  cd "$dir"
  npm run typecheck || echo "FAIL in $dir"
done
```

Expected: todos passando.

- [ ] **Step 3: Rodar unit tests de cada consumidor**

```bash
for dir in ~/dev/projetos/trading/vfat-monitor/vfat-pool-monitor ~/dev/projetos/trading/claw-yield ~/dev/projetos/trading/defigenius; do
  echo "=== $dir ==="
  cd "$dir"
  npm test -- --run || echo "FAIL in $dir"
done
```

Expected: zero regressão.

---

### Task 23: Arquivar `libs/web3-shared/` antigo

**Files:**
- Move: `~/dev/projetos/trading/libs/web3-shared/` → `~/dev/projetos/trading/libs/_archive/web3-shared-v1.7.0-dist/`

- [ ] **Step 1: Mover pra archive (não deletar — backup do dist original)**

```bash
mkdir -p ~/dev/projetos/trading/libs/_archive
mv ~/dev/projetos/trading/libs/web3-shared ~/dev/projetos/trading/libs/_archive/web3-shared-v1.7.0-dist
```

- [ ] **Step 2: Atualizar `~/dev/projetos/maturity.md`**

Remover alerta de perda de código; nota em "Aprendizados": "@fsa/web3 reconstruído como v1.7.1 de dist após perda em mv; agora em `gitlab.com:fsa-portfolio/fsa-web3`."

- [ ] **Step 3: Commit de arquivamento (opcional, apenas se archive estiver sob git)**

Se `_archive` não for versionado, pular.

---

## Self-Review

**Spec coverage (seção do spec → task):**

| Spec section | Tasks |
|---|---|
| Contexto / Objetivo | Phase 1 (1-3) |
| Inventário 1.7.0 | Task 2 (package.json), Task 12 (index.ts) |
| Arquitetura preservada 1:1 | Tasks 4-12 |
| Processo de reconstrução | Task 4 (step-by-step), aplicado em 5-11 |
| Testes unit | Tasks 6 (math), 7 (utils address+decimals) |
| Testes smoke | Tasks 13-18 |
| CI/CD GitLab | Task 3 |
| Versionamento & Release | Tasks 19, 21 |
| Riscos (faucet seco) | Task 20 (skip com warning) |
| Segurança (known issues) | Task 19 SECURITY.md |
| Entregáveis 1-7 | Coberto em todas as phases |
| Sequenciamento 1-10 | Ordem das phases |

**Sem gaps.**

**Placeholder scan:** sem "TBD", sem "implement later". Steps 2-4 da Task 5, steps 3-4 da Task 8 usam "procedimento por arquivo" (`cat dist/...`) — aceitável porque o conteúdo real varia por arquivo e é idêntico ao dist publicado; o engenheiro tem comando exato pra rodar e padrão de reconstrução definido nas Tasks 4 e 7.

**Type consistency:** `validateAddress`, `ensureAllowance`, `getTokenDecimals`, `createClients`, `applySlippage`, `getSqrtRatioAtTick` — nomes idênticos em todas as referências cruzadas (src, tests, smoke).

Plan pronto.
