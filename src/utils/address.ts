import { isAddress, getAddress, type Address } from "viem";
import { AddressValidationError } from "../errors.js";

export function validateAddress(addr: string): Address {
  if (!isAddress(addr)) {
    throw new AddressValidationError(addr);
  }
  return getAddress(addr);
}
