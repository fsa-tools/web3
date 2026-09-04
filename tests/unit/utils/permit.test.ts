import { describe, it, expect, vi } from "vitest";
import {
  ContractFunctionExecutionError,
  ContractFunctionZeroDataError,
  encodeAbiParameters,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { ERC20_PERMIT_ABI } from "../../../src/abis/erc20-permit.js";
import {
  buildPermitTypedData,
  supportsPermit,
} from "../../../src/utils/permit.js";
import { PermitDomainMismatchError } from "../../../src/errors.js";
import type { ChainContext } from "../../../src/context.js";

const TOKEN: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";
const SPENDER: Address = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
const BASE_CHAIN_ID = 8453;
const DEADLINE = 1_800_000_000n;

/**
 * Domain separator derivado da formula do EIP-712 (keccak do typehash +
 * campos encodados), nao de `hashDomain` — para que o teste discorde da
 * implementacao se ela errar a construcao do dominio.
 */
function eip712DomainSeparator(params: {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}): Hex {
  const typeHash = keccak256(
    toBytes(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    ),
  );
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        typeHash,
        keccak256(toBytes(params.name)),
        keccak256(toBytes(params.version)),
        BigInt(params.chainId),
        params.verifyingContract,
      ],
    ),
  );
}

type TokenStub = {
  name?: string;
  nonce?: bigint;
  domainSeparator?: Hex;
  /** Funcoes ausentes no contrato — viem devolve ContractFunctionExecutionError. */
  revertOn?: ReadonlyArray<string>;
  /** Falha de transporte (RPC fora), nao resposta do contrato. */
  transportError?: boolean;
};

function mockCtx(stub: TokenStub): ChainContext {
  return {
    publicClient: {
      chain: { id: BASE_CHAIN_ID },
      readContract: vi.fn(
        async ({
          functionName,
          args,
        }: {
          functionName: string;
          args?: readonly unknown[];
        }) => {
          if (stub.transportError) {
            throw new Error("HTTP request failed: 503 Service Unavailable");
          }
          if (stub.revertOn?.includes(functionName)) {
            throw new ContractFunctionExecutionError(
              new ContractFunctionZeroDataError({ functionName }),
              { abi: ERC20_PERMIT_ABI, functionName, args },
            );
          }
          if (functionName === "name") return stub.name;
          if (functionName === "nonces") return stub.nonce;
          if (functionName === "DOMAIN_SEPARATOR") return stub.domainSeparator;
          throw new Error(`unexpected read: ${functionName}`);
        },
      ),
    },
  } as unknown as ChainContext;
}

describe("buildPermitTypedData", () => {
  it("monta o payload EIP-712 com o nonce lido do token", async () => {
    const ctx = mockCtx({
      name: "Test Token",
      nonce: 7n,
      domainSeparator: eip712DomainSeparator({
        name: "Test Token",
        version: "1",
        chainId: BASE_CHAIN_ID,
        verifyingContract: TOKEN,
      }),
    });

    const typedData = await buildPermitTypedData(ctx, {
      token: TOKEN,
      owner: OWNER,
      spender: SPENDER,
      value: 5_000_000n,
      deadline: DEADLINE,
    });

    expect(typedData.primaryType).toBe("Permit");
    expect(typedData.domain).toEqual({
      name: "Test Token",
      version: "1",
      chainId: BASE_CHAIN_ID,
      verifyingContract: TOKEN,
    });
    expect(typedData.message).toEqual({
      owner: OWNER,
      spender: SPENDER,
      value: 5_000_000n,
      nonce: 7n,
      deadline: DEADLINE,
    });
    expect(typedData.types.Permit).toEqual([
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ]);
  });

  it("descobre version \"2\" quando o DOMAIN_SEPARATOR do token so casa com ela (caso USDC)", async () => {
    const ctx = mockCtx({
      name: "USD Coin",
      nonce: 0n,
      domainSeparator: eip712DomainSeparator({
        name: "USD Coin",
        version: "2",
        chainId: BASE_CHAIN_ID,
        verifyingContract: TOKEN,
      }),
    });

    const typedData = await buildPermitTypedData(ctx, {
      token: TOKEN,
      owner: OWNER,
      spender: SPENDER,
      value: 1_000_000n,
      deadline: DEADLINE,
    });

    expect(typedData.domain.version).toBe("2");
  });

  it("rejeita com PermitDomainMismatchError quando nenhuma version reproduz o DOMAIN_SEPARATOR", async () => {
    const ctx = mockCtx({
      name: "Weird Token",
      nonce: 0n,
      domainSeparator: eip712DomainSeparator({
        name: "Weird Token",
        version: "42",
        chainId: BASE_CHAIN_ID,
        verifyingContract: TOKEN,
      }),
    });

    await expect(
      buildPermitTypedData(ctx, {
        token: TOKEN,
        owner: OWNER,
        spender: SPENDER,
        value: 1n,
        deadline: DEADLINE,
      }),
    ).rejects.toBeInstanceOf(PermitDomainMismatchError);
  });

  it("usa a version explicita do chamador em vez dos candidatos padrao", async () => {
    const ctx = mockCtx({
      name: "Weird Token",
      nonce: 3n,
      domainSeparator: eip712DomainSeparator({
        name: "Weird Token",
        version: "42",
        chainId: BASE_CHAIN_ID,
        verifyingContract: TOKEN,
      }),
    });

    const typedData = await buildPermitTypedData(ctx, {
      token: TOKEN,
      owner: OWNER,
      spender: SPENDER,
      value: 1n,
      deadline: DEADLINE,
      version: "42",
    });

    expect(typedData.domain.version).toBe("42");
  });

  it("rejeita version explicita que nao reproduz o DOMAIN_SEPARATOR", async () => {
    const ctx = mockCtx({
      name: "Weird Token",
      nonce: 3n,
      domainSeparator: eip712DomainSeparator({
        name: "Weird Token",
        version: "42",
        chainId: BASE_CHAIN_ID,
        verifyingContract: TOKEN,
      }),
    });

    await expect(
      buildPermitTypedData(ctx, {
        token: TOKEN,
        owner: OWNER,
        spender: SPENDER,
        value: 1n,
        deadline: DEADLINE,
        version: "7",
      }),
    ).rejects.toBeInstanceOf(PermitDomainMismatchError);
  });
});

describe("supportsPermit", () => {
  it("true quando nonces e DOMAIN_SEPARATOR respondem (caso USDC na Base)", async () => {
    const ctx = mockCtx({
      name: "USD Coin",
      nonce: 0n,
      domainSeparator: eip712DomainSeparator({
        name: "USD Coin",
        version: "2",
        chainId: BASE_CHAIN_ID,
        verifyingContract: TOKEN,
      }),
    });
    await expect(supportsPermit(ctx, { token: TOKEN })).resolves.toBe(true);
  });

  it("false quando DOMAIN_SEPARATOR reverte (caso WETH na Base)", async () => {
    const ctx = mockCtx({ nonce: 0n, revertOn: ["DOMAIN_SEPARATOR"] });
    await expect(supportsPermit(ctx, { token: TOKEN })).resolves.toBe(false);
  });

  it("false quando nonces reverte", async () => {
    const ctx = mockCtx({
      domainSeparator:
        "0x3333333333333333333333333333333333333333333333333333333333333333",
      revertOn: ["nonces"],
    });
    await expect(supportsPermit(ctx, { token: TOKEN })).resolves.toBe(false);
  });

  it("propaga falha de transporte em vez de reporta-la como ausencia de permit", async () => {
    const ctx = mockCtx({ transportError: true });
    await expect(supportsPermit(ctx, { token: TOKEN })).rejects.toThrow(
      /HTTP request failed/,
    );
  });
});
