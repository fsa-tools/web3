import { decodeFunctionResult, encodeFunctionData } from "viem";
import type { Address, Hex } from "viem";
import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import type { SimulationProbe } from "../../simulate/types.js";
import type { AccountData } from "./types.js";

/**
 * Probe de `getUserAccountData` para uso com `SimulateTxRequestsOptions.probes`:
 * expõe health factor (e o resto de `AccountData`) pré/pós a sequência simulada,
 * no mesmo bloco encadeado do eth_simulateV1.
 */
export function aaveAccountDataProbe(
  ctx: ChainContext,
  user: Address,
): SimulationProbe<AccountData> {
  if (!ctx.addresses.aave) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "aave",
    );
  }

  return {
    label: "aave-account-data",
    to: ctx.addresses.aave.pool,
    data: encodeFunctionData({
      abi: AAVE_POOL_ABI,
      functionName: "getUserAccountData",
      args: [user],
    }),
    decode: (data: Hex) => decodeAccountData(data),
  };
}

function decodeAccountData(data: Hex): AccountData {
  const [
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactor,
  ] = decodeFunctionResult({
    abi: AAVE_POOL_ABI,
    functionName: "getUserAccountData",
    data,
  });

  return {
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactor,
  };
}
