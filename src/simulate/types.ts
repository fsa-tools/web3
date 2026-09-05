import type { Abi, Address, Hex } from "viem";

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

/**
 * Leitura `view` genérica que o simulador prefixa e sufixa no mesmo batch de
 * eth_simulateV1 (pré e pós vêm do mesmo bloco, com o estado encadeado, sem
 * RPC extra). Ex.: `aaveAccountDataProbe` para expor health factor pré/pós.
 */
export type SimulationProbe<T = unknown> = {
  readonly label: string;
  readonly to: Address;
  readonly data: Hex;
  readonly decode: (data: Hex) => T;
};

export type ProbeDiff<T = unknown> = {
  readonly label: string;
  readonly pre: T;
  readonly post: T;
};

export type SimulateTxRequestsOptions = {
  readonly from: Address;
  /** ABIs de protocolo com custom errors a considerar na decodificação de revert, além de Error(string)/Panic(uint256) (sempre disponíveis) e dos códigos numéricos da Aave. */
  readonly abis?: readonly Abi[];
  /** Leituras `view` executadas antes e depois da sequência de txs, no mesmo batch encadeado. Só surtem efeito no caminho chained. */
  readonly probes?: readonly SimulationProbe[];
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
  /** Pré/pós de cada probe, na ordem passada em `options.probes`. Só disponível no caminho chained. */
  readonly probeDiffs?: readonly ProbeDiff[];
};
