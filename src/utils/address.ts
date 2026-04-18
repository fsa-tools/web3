import { isAddress, getAddress, type Address } from "viem";

export function validateAddress(addr: string): Address {
  if (!isAddress(addr)) {
    throw new Error(`Invalid Ethereum address: ${addr}`);
  }
  return getAddress(addr);
}
