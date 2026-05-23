import { describe, it, expect } from "vitest";
import { AAVE_POOL_ABI } from "../../src/abis/aave-pool.js";

describe("AAVE_POOL_ABI", () => {
  it("expõe a função repay(asset, amount, interestRateMode, onBehalfOf)", () => {
    const repay = AAVE_POOL_ABI.find(
      (entry) => entry.type === "function" && entry.name === "repay",
    );
    expect(repay).toBeDefined();
    expect(repay?.inputs).toEqual([
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
    ]);
    expect(repay?.outputs).toEqual([{ name: "", type: "uint256" }]);
    expect(repay?.stateMutability).toBe("nonpayable");
  });
});
