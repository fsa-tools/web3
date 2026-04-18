# Design — Task 3 (v1.8): Aave Sepolia smoke fix

**Data:** 2026-04-18
**Escopo:** v1.8 incremental, task 3 do ROADMAP.md
**Arquivos afetados:** `tests/smoke/_helpers.ts`, `tests/smoke/aave.smoke.test.ts`

## Problema

O smoke test `aave.smoke — sepolia` falha com revert `51` (`RESERVE_INACTIVE_OR_NOT_LISTED`) do Aave Pool V3 ao chamar `supply()`.

**Causa raiz:** `aave.smoke.test.ts` usa `cfg.faucetTokens.usdc` como `asset`. Mas Aave V3 testnet só aceita tokens da sua própria lista de reservas (tokens mock redeployados com `mint()` público e aToken correspondente). O endereço em `faucetTokens.usdc` é genérico — serve pra Uniswap/Aerodrome, mas não está listado como reserva no Aave Pool de Sepolia.

Mesmo problema existe latente em Amoy (task não chegou a exercitar).

## Objetivo

Smoke `aave.smoke — sepolia` executa com sucesso: `supply 1 USDC → getUserAccountData → withdraw`, dado que a carteira tenha saldo da USDC-Aave-testnet.

## Design

### 1. Estender `SmokeChainConfig`

Em `tests/smoke/_helpers.ts`, adicionar campo opcional:

```ts
export type SmokeChainConfig = {
  // ... campos existentes
  aaveReserves?: {
    usdc?: `0x${string}`;
    weth?: `0x${string}`;
  };
};
```

Separa a intenção: `faucetTokens` = tokens genéricos para Uniswap/Aerodrome; `aaveReserves` = tokens que o Aave Pool daquela chain listou como reserva ativa.

### 2. Popular endereços reais

Para cada chain em `SMOKE_CHAINS`, preencher `aaveReserves` com endereços descobertos na fase de implementação via uma das fontes (em ordem de preferência):

1. **Aave Address Book** (`github.com/bgd-labs/aave-address-book`) — fonte canônica mantida pela Aave.
2. **`pool.getReservesList()` on-chain** — fallback para validação dinâmica.

Apenas `usdc` é obrigatório (usado pelo smoke atual). `weth` é reservado para extensão futura.

### 3. Migrar `aave.smoke.test.ts`

Trocar referências de `cfg.faucetTokens.usdc` para `cfg.aaveReserves?.usdc`:

- **Gate `canRun`:** `env && cfg.protocols.aavePool && cfg.aaveReserves?.usdc`
- **`asset`:** `cfg.aaveReserves!.usdc`

Nenhuma outra mudança no fluxo do teste.

### 4. Mensagem de saldo insuficiente

Quando `bal < amount`, o `console.warn` atual ("insufficient USDC") deve orientar explicitamente: as reservas testnet do Aave têm função `mint()` pública — a mensagem aponta o endereço do token e sugere interação via block explorer.

## Fora de escopo

- Código de produção (`src/protocols/aave/*`) não muda.
- Smoke tests de Uniswap V3 e Aerodrome não tocam — `faucetTokens` permanece como está.
- Automação de funding (mint via teste) não entra aqui — fica para uma task dedicada se virar problema recorrente.

## Testing strategy

- Rodar `aave.smoke.test.ts` localmente contra Sepolia com carteira fundada e validar: `txHash` matches regex, `totalCollateralBase > 0`, withdraw passa.
- Validar que a não-configuração de `aaveReserves` (Amoy, se não houver endereço validado ainda) gera *skip*, não falha — fluxo `canRun` continua resiliente.

## Riscos

- **Aave V3 testnet faz redeploy ocasional.** Endereços podem mudar. Mitigação: ponto único de atualização em `_helpers.ts`.
- **USDC Aave-testnet pode ter decimals diferente** (alguns mocks usam 6, outros 18). O teste já resolve dinamicamente via `getTokenDecimals` — sem impacto.

## Definition of done

- [ ] `SmokeChainConfig.aaveReserves` adicionado com tipo correto.
- [ ] Sepolia popula `aaveReserves.usdc` com endereço validado da lista de reservas do Aave Pool.
- [ ] Amoy popula `aaveReserves.usdc` se endereço validado existir; caso contrário omite (smoke skipa).
- [ ] `aave.smoke.test.ts` usa `aaveReserves.usdc` em vez de `faucetTokens.usdc`.
- [ ] Smoke roda green em Sepolia com carteira fundada (validado localmente).
- [ ] Sem `as any`; sem mudanças em código de produção.
- [ ] `CHANGELOG.md` e `ROADMAP.md` atualizados (task 3 marcada como concluída).
