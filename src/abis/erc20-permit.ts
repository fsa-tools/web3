import { ERC20_ABI } from "./erc20.js";

const ERC20_NAME_ABI = ERC20_ABI.find((entry) => entry.name === "name");
if (!ERC20_NAME_ABI) {
  throw new Error("ERC20_ABI não expõe name()");
}

/** Superfície EIP-2612 de um ERC20 — o que a detecção e o typed data leem. */
export const ERC20_PERMIT_ABI = [
  ERC20_NAME_ABI,
  {
    name: "nonces",
    type: "function",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "DOMAIN_SEPARATOR",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const;
