import type { Abi, Address } from "viem";

export type AssetDiff = {
  readonly token: Address;
  readonly symbol?: string;
  readonly decimals?: number;
  readonly pre: bigint;
  readonly post: bigint;
  readonly diff: bigint;
};

export type TxSimulationResult = {
  readonly label: string;
  readonly to: Address;
  readonly status: "ok" | "revert";
  readonly gasUsed: bigint;
  readonly reason?: string;
};

export type SimulateTxRequestsOptions = {
  readonly from: Address;
  /** ABIs de protocolo com custom errors a considerar na decodificação de revert, além de Error(string)/Panic(uint256) (sempre disponíveis) e dos códigos numéricos da Aave. */
  readonly abis?: readonly Abi[];
};

export type SimulateTxRequestsResult = {
  /**
   * true: simulado via eth_simulateV1, estado encadeado entre as txs.
   * false: fallback eth_call isolado por tx — sem encadeamento de estado.
   */
  readonly chained: boolean;
  readonly results: readonly TxSimulationResult[];
  /** Diffs de saldo agregados da sequência inteira (pré-primeira-tx → pós-última-tx). Só disponível no caminho chained. */
  readonly assetDiffs?: readonly AssetDiff[];
};
