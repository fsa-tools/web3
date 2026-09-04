import {
  ContractFunctionExecutionError,
  domainSeparator,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { ERC20_PERMIT_ABI } from "../abis/erc20-permit.js";
import type { ChainContext } from "../context.js";
import { PermitDomainMismatchError } from "../errors.js";

/**
 * Assinatura EIP-2612 já quebrada em (v, r, s) e o deadline que ela cobre.
 * É o que `Pool.supplyWithPermit` / `Pool.repayWithPermit` consomem.
 */
export type PermitSignature = {
  readonly deadline: bigint;
  readonly v: number;
  readonly r: Hex;
  readonly s: Hex;
};

const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export type PermitTypedData = {
  readonly domain: {
    readonly name: string;
    readonly version: string;
    readonly chainId: number;
    readonly verifyingContract: Address;
  };
  readonly types: typeof PERMIT_TYPES;
  readonly primaryType: "Permit";
  readonly message: {
    readonly owner: Address;
    readonly spender: Address;
    readonly value: bigint;
    readonly nonce: bigint;
    readonly deadline: bigint;
  };
};

export type BuildPermitTypedDataParams = {
  readonly token: Address;
  readonly owner: Address;
  readonly spender: Address;
  readonly value: bigint;
  readonly deadline: bigint;
  /** Escapatória para tokens fora dos candidatos padrão; ainda é provada contra o DOMAIN_SEPARATOR. */
  readonly version?: string;
};

/**
 * Versões de domínio EIP-712 tentadas quando o chamador não informa uma.
 * `version()` não é padronizado no EIP-2612 e a maioria dos tokens não o expõe;
 * "1" é o default do OpenZeppelin e "2" é o do USDC (FiatTokenV2).
 */
const PERMIT_VERSION_CANDIDATES = ["1", "2"] as const;

function resolveVersion(
  candidates: readonly string[],
  onChainSeparator: Hex,
  base: { name: string; chainId: number; verifyingContract: Address },
): string | undefined {
  return candidates.find(
    (version) =>
      domainSeparator({ domain: { ...base, version } }) === onChainSeparator,
  );
}

/**
 * Monta a mensagem EIP-712 do permit EIP-2612, pronta para
 * `walletClient.signTypedData`. Lê `name`, `nonces(owner)` e
 * `DOMAIN_SEPARATOR()` do token, e prova que o domínio montado reproduz o
 * separator on-chain antes de devolvê-lo.
 */
export async function buildPermitTypedData(
  ctx: ChainContext,
  params: BuildPermitTypedDataParams,
): Promise<PermitTypedData> {
  const { publicClient } = ctx;
  const chainId = publicClient.chain?.id ?? (await publicClient.getChainId());

  const [name, nonce, onChainSeparator] = await Promise.all([
    publicClient.readContract({
      address: params.token,
      abi: ERC20_PERMIT_ABI,
      functionName: "name",
    }),
    publicClient.readContract({
      address: params.token,
      abi: ERC20_PERMIT_ABI,
      functionName: "nonces",
      args: [params.owner],
    }),
    publicClient.readContract({
      address: params.token,
      abi: ERC20_PERMIT_ABI,
      functionName: "DOMAIN_SEPARATOR",
    }),
  ]);

  const base = { name, chainId, verifyingContract: params.token };
  const candidates = params.version
    ? [params.version]
    : PERMIT_VERSION_CANDIDATES;
  const version = resolveVersion(candidates, onChainSeparator, base);
  if (!version) {
    throw new PermitDomainMismatchError(params.token, candidates);
  }

  return {
    domain: { ...base, version },
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message: {
      owner: params.owner,
      spender: params.spender,
      value: params.value,
      nonce,
      deadline: params.deadline,
    },
  };
}

export type SupportsPermitParams = {
  readonly token: Address;
};

/**
 * Detecta suporte a EIP-2612 lendo `nonces(owner)` e `DOMAIN_SEPARATOR()`.
 * Qualquer uma das duas ausente (revert) ⇒ o token não faz permit e o
 * chamador deve cair no fallback approve + ação (`planSupply` / `planRepay`).
 * WETH é o caso negativo canônico na Base.
 */
export async function supportsPermit(
  ctx: ChainContext,
  params: SupportsPermitParams,
): Promise<boolean> {
  const { publicClient } = ctx;
  try {
    await Promise.all([
      publicClient.readContract({
        address: params.token,
        abi: ERC20_PERMIT_ABI,
        functionName: "nonces",
        args: [zeroAddress],
      }),
      publicClient.readContract({
        address: params.token,
        abi: ERC20_PERMIT_ABI,
        functionName: "DOMAIN_SEPARATOR",
      }),
    ]);
    return true;
  } catch (error) {
    // O contrato não expõe a função (revert / retorno vazio) ⇒ sem permit.
    // Falha de transporte não é resposta do token: propaga, senão um RPC fora
    // do ar viraria "não suporta permit" e o chamador cairia no fallback sem saber.
    if (error instanceof ContractFunctionExecutionError) {
      return false;
    }
    throw error;
  }
}
