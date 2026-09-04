import { describe, it, expect } from "vitest";
import { AAVE_POOL_ABI } from "../../src/abis/aave-pool.js";
import { ERC20_ABI } from "../../src/abis/erc20.js";
import { ERC20_PERMIT_ABI } from "../../src/abis/erc20-permit.js";

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

describe("ERC20_ABI", () => {
  it("expõe a função name() view retornando string", () => {
    const name = ERC20_ABI.find(
      (entry) => entry.type === "function" && entry.name === "name",
    );
    expect(name).toBeDefined();
    expect(name?.inputs).toEqual([]);
    expect(name?.outputs).toEqual([{ name: "", type: "string" }]);
    expect(name?.stateMutability).toBe("view");
  });
});

describe("ERC20_PERMIT_ABI", () => {
  it("reaproveita a entrada name() de ERC20_ABI em vez de redeclará-la", () => {
    const nameFromPermit = ERC20_PERMIT_ABI.find(
      (entry) => entry.type === "function" && entry.name === "name",
    );
    const nameFromBase = ERC20_ABI.find(
      (entry) => entry.type === "function" && entry.name === "name",
    );
    expect(nameFromPermit).toBe(nameFromBase);
  });
});
