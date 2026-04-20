# Aave Sepolia smoke fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o revert `51 (RESERVE_INACTIVE_OR_NOT_LISTED)` em `aave.smoke — sepolia`, separando tokens genéricos de faucet (Uniswap/Aerodrome) das reservas listadas no Aave Pool V3 testnet.

**Architecture:** Adicionar campo opcional `aaveReserves` em `SmokeChainConfig`, popular o endereço canônico da USDC-Aave-testnet em Sepolia (via Aave Address Book), e migrar `aave.smoke.test.ts` para usar esse campo no gate `canRun` e como `asset`. Amoy recebe o mesmo tratamento se endereço validado existir; caso contrário o smoke skipa por design.

**Tech Stack:** TypeScript (ESM, NodeNext), Vitest, viem, Aave V3 Pool.

---

## File Structure

- `tests/smoke/_helpers.ts` — adiciona `aaveReserves` no tipo e popula endereços canônicos por chain. Ponto único de atualização para redeploys do Aave V3 testnet.
- `tests/smoke/aave.smoke.test.ts` — consome `cfg.aaveReserves?.usdc` no gate e no `asset`. Atualiza a mensagem de warn para orientar `mint()` público.
- `CHANGELOG.md` / `ROADMAP.md` — registro da task.

Nenhum código de produção (`src/protocols/aave/*`) é tocado.

---

### Task 1: Estender `SmokeChainConfig` com `aaveReserves`

**Files:**
- Modify: `tests/smoke/_helpers.ts:3-18`

- [ ] **Step 1: Adicionar campo `aaveReserves` ao tipo**

Editar o bloco de tipo para incluir o novo campo opcional, separando a intenção dos tokens de faucet:

```ts
export type SmokeChainConfig = {
  chainId: number;
  name: string;
  rpcEnvVar: string;
  pkEnvVar: string;
  faucetTokens: {
    weth?: `0x${string}`;
    usdc?: `0x${string}`;
  };
  aaveReserves?: {
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
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS (nenhum erro — o campo é opcional e não quebra consumidores existentes).

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/_helpers.ts
git commit -m "test(smoke): add aaveReserves field to SmokeChainConfig"
```

---

### Task 2: Popular `aaveReserves.usdc` para Sepolia (e Amoy se validado)

**Files:**
- Modify: `tests/smoke/_helpers.ts:20-49`

Descobrir endereços canônicos via Aave Address Book antes de editar.

- [ ] **Step 1: Resolver endereço canônico da USDC-Aave-testnet em Sepolia**

Fonte primária: `https://github.com/bgd-labs/aave-address-book` → `src/AaveV3Sepolia.sol` → `ASSETS.USDC.UNDERLYING`.

Fallback de validação on-chain (executar apenas se houver dúvida):

```bash
cast call 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951 \
  "getReservesList()(address[])" \
  --rpc-url "$SEPOLIA_RPC"
```

Anotar o endereço retornado. Esperado (referência — reconfirmar na execução): `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8` pode NÃO estar na lista; o valor canônico da Aave é diferente do `faucetTokens.usdc`.

- [ ] **Step 2: Resolver endereço canônico para Polygon Amoy (best-effort)**

Fonte primária: `src/AaveV3PolygonAmoy.sol` no mesmo repo, se existir.

Fallback:

```bash
cast call 0x1758d4e6f68166C4B2d9d0F049F33dEB399Daa1F \
  "getReservesList()(address[])" \
  --rpc-url "$POLYGON_AMOY_RPC"
```

Se nenhuma fonte retornar USDC listada na reserve list, deixar `aaveReserves` omitido em Amoy (o smoke skipa por design — é o comportamento desejado até a task dedicada).

- [ ] **Step 3: Editar `SMOKE_CHAINS` com os endereços validados**

Preencher `aaveReserves.usdc` em Sepolia com o endereço confirmado no Step 1. Em Amoy, preencher apenas se Step 2 produziu endereço validado.

```ts
export const SMOKE_CHAINS: Record<string, SmokeChainConfig> = {
  sepolia: {
    chainId: 11155111,
    name: "sepolia",
    rpcEnvVar: "SEPOLIA_RPC",
    pkEnvVar: "SMOKE_PK_SEPOLIA",
    faucetTokens: {
      weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    },
    aaveReserves: {
      usdc: "0x<ENDERECO_VALIDADO_SEPOLIA>" as `0x${string}`,
    },
    protocols: {
      uniswapV3Npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      aavePool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
    },
  },
  polygonAmoy: {
    chainId: 80002,
    name: "polygon-amoy",
    rpcEnvVar: "POLYGON_AMOY_RPC",
    pkEnvVar: "SMOKE_PK_POLYGON",
    faucetTokens: {
      weth: "0x52eF3d68BaB452a294342DC3e5f464d7f610f72E",
      usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    },
    // aaveReserves omitido se não houver endereço validado — smoke skipa por design
    protocols: {
      uniswapV3Npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      aavePool: "0x1758d4e6f68166C4B2d9d0F049F33dEB399Daa1F",
    },
  },
};
```

Substituir `0x<ENDERECO_VALIDADO_SEPOLIA>` pelo endereço real do Step 1 (sem o placeholder `as` cast — o literal `0x...` já é `\`0x${string}\``).

- [ ] **Step 4: Validar typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/smoke/_helpers.ts
git commit -m "test(smoke): populate Aave V3 reserves for sepolia (amoy if validated)"
```

---

### Task 3: Migrar `aave.smoke.test.ts` para usar `aaveReserves.usdc`

**Files:**
- Modify: `tests/smoke/aave.smoke.test.ts:8-14,26-27`

- [ ] **Step 1: Trocar gate `canRun` e variável `asset`**

Substituir o bloco de iteração do loop para consumir `aaveReserves?.usdc` em vez de `faucetTokens.usdc`, e atualizar a mensagem de warn para orientar o uso do `mint()` público da reserva:

```ts
for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const env = loadChainEnv(cfg);
  const canRun = env && cfg.protocols.aavePool && cfg.aaveReserves?.usdc;
  describe.skipIf(!canRun)(`aave smoke — ${cfg.name}`, () => {
    if (!canRun) return;
    const pool = cfg.protocols.aavePool!;
    const asset = cfg.aaveReserves!.usdc!;

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
        console.warn(
          `Skipping aave ${cfg.name} — insufficient USDC on Aave reserve ${asset}. ` +
            `Aave V3 testnet reserves expose a public mint() — fund the wallet via block explorer before re-running.`,
        );
        return;
      }

      await ensureAllowance({
        publicClient,
        walletClient: walletClient!,
        token: asset,
        spender: pool,
        amount,
      });
      const supplyResult = await aave.supply({
        publicClient,
        walletClient: walletClient!,
        chainId: cfg.chainId,
        asset,
        amount,
      });
      expect(supplyResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      const acct = await aave.getUserAccountData({
        publicClient,
        chainId: cfg.chainId,
        user: owner,
      });
      expect(acct.totalCollateralBase).toBeGreaterThan(0n);

      const withdrawResult = await aave.withdraw({
        publicClient,
        walletClient: walletClient!,
        chainId: cfg.chainId,
        asset,
        amount,
      });
      expect(withdrawResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    }, 120_000);
  });
}
```

- [ ] **Step 2: Validar typecheck + estrutura dos testes**

Run: `pnpm tsc --noEmit && pnpm vitest --run tests/smoke/aave.smoke.test.ts --reporter=verbose`
Expected no CI sem env: skip em todas as chains (nenhum erro, nenhum fail — apenas `SKIP`). Em uma máquina com `SEPOLIA_RPC` e `SMOKE_PK_SEPOLIA` configurados mas carteira sem saldo da reserva: o teste entra, dispara o warn atualizado e retorna.

- [ ] **Step 3: Confirmar fluxo de skip em Amoy (se `aaveReserves` omitido)**

Caso Amoy tenha sido omitido na Task 2, rodar:

Run: `pnpm vitest --run tests/smoke/aave.smoke.test.ts -t "aave smoke — polygon-amoy"`
Expected: `0 passed | 1 skipped` (ou ausência do describe no report). Nunca `FAIL`.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke/aave.smoke.test.ts
git commit -m "test(smoke): route aave smoke through aaveReserves.usdc"
```

---

### Task 4: Validação green em Sepolia com carteira fundada

**Files:**
- (nenhuma edição — fase de verificação manual)

- [ ] **Step 1: Conferir saldo da USDC-Aave em Sepolia**

Com `SEPOLIA_RPC` e `SMOKE_PK_SEPOLIA` exportados, verificar saldo do token configurado em `aaveReserves.usdc` na carteira do smoke:

```bash
cast call "<ENDERECO_VALIDADO_SEPOLIA>" \
  "balanceOf(address)(uint256)" \
  "<ADDRESS_DA_CARTEIRA>" \
  --rpc-url "$SEPOLIA_RPC"
```

Se retornar `0`, usar o `mint()` público da reserva via block explorer (Etherscan Sepolia → contrato da USDC-Aave → Write Contract → `mint`).

- [ ] **Step 2: Rodar o smoke**

Run: `pnpm vitest --run tests/smoke/aave.smoke.test.ts -t "aave smoke — sepolia"`
Expected: `1 passed`. Asserts cumpridos:
- `supplyResult.txHash` bate com `/^0x[0-9a-f]{64}$/i`
- `acct.totalCollateralBase > 0n`
- `withdrawResult.txHash` bate com `/^0x[0-9a-f]{64}$/i`

- [ ] **Step 3: Em caso de falha, diagnosticar**

Se ainda retornar `RESERVE_INACTIVE_OR_NOT_LISTED` (`51`): o endereço populado não está na reserve list. Reexecutar `getReservesList()` da Task 2 Step 1 e confirmar match exato (case-insensitive). Se retornar outro erro, anotar e abrir investigação — não mascarar.

---

### Task 5: Atualizar CHANGELOG e ROADMAP

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Adicionar entrada no CHANGELOG**

Incluir no topo da seção Unreleased / v1.8 (seguir estilo existente do arquivo — manter Keep a Changelog):

```markdown
### Fixed
- `aave.smoke — sepolia`: revert `51 (RESERVE_INACTIVE_OR_NOT_LISTED)` resolvido separando `aaveReserves` de `faucetTokens` em `SmokeChainConfig`. Sepolia agora usa o endereço canônico da USDC-Aave-testnet (Aave Address Book). Amoy permanece skipado até endereço validado.
```

- [ ] **Step 2: Marcar task 3 no ROADMAP**

Localizar o bloco da v1.8 task 3 no `ROADMAP.md` e marcar a checkbox como concluída (`- [x]`), mantendo qualquer texto descritivo intacto.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md ROADMAP.md
git commit -m "docs: v1.8 task 3 — aave sepolia smoke fix complete"
```

---

## Definition of Done (spec cross-check)

- [x] `SmokeChainConfig.aaveReserves` adicionado com tipo correto — Task 1.
- [x] Sepolia popula `aaveReserves.usdc` com endereço validado — Task 2 Steps 1, 3.
- [x] Amoy popula se validado, senão omite e smoke skipa — Task 2 Steps 2, 3.
- [x] `aave.smoke.test.ts` usa `aaveReserves.usdc` — Task 3.
- [x] Smoke green em Sepolia com carteira fundada — Task 4.
- [x] Sem `as any`; sem mudanças em código de produção — Tasks 1-3 (revisar antes do último commit).
- [x] `CHANGELOG.md` e `ROADMAP.md` atualizados — Task 5.
