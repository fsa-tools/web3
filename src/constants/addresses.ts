import type { Address } from "viem";

export type ProtocolAddresses = {
  npm: Address;
  factory?: Address;
  swapRouter?: Address;
};

export type AaveAddresses = {
  pool: Address;
};

export type ChainAddresses = {
  weth: Address;
  wethUsdcPool?: Address;
  uniswapV3?: ProtocolAddresses;
  aerodrome?: ProtocolAddresses;
  aave?: AaveAddresses;
};

/** @internal — use ctx.addresses via createChainContext instead of direct access */
export const ADDRESSES: Record<number, ChainAddresses> = {
  8453: {
    weth: "0x4200000000000000000000000000000000000006",
    wethUsdcPool: "0xd0b53D9277642d899DF5C87A3966A349A798F224",
    aerodrome: {
      npm: "0x827922686190790b37229fd06084350E74485b72",
    },
    uniswapV3: {
      npm: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
      factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
      swapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481",
    },
  },
  1: {
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    wethUsdcPool: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
    uniswapV3: {
      npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      swapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    },
    aave: {
      pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    },
  },
  10: {
    weth: "0x4200000000000000000000000000000000000006",
    wethUsdcPool: "0x85149247691df622eaF1a8Bd0CaFd40BC45154a9",
    uniswapV3: {
      npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      swapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    },
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    },
  },
  42161: {
    weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    wethUsdcPool: "0xC6962004f452bE9203591991D15f6b388e09E8D0",
    uniswapV3: {
      npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      swapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    },
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    },
  },
  137: {
    weth: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    wethUsdcPool: "0xB6e57ed85c4c9dbfEF2a68711e9d6f36c56e0FcB",
    uniswapV3: {
      npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      swapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    },
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    },
  },
  11155111: {
    weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    wethUsdcPool: "0x4d8cad269d06fd610334ccda8384857c2d9327d1",
    uniswapV3: {
      npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
      swapRouter: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    },
    aave: {
      pool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
    },
  },
  80002: {
    weth: "0x52eF3d68BaB452a294342DC3e5f464d7f610f72E",
    uniswapV3: {
      npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    aave: {
      pool: "0x1758d4e6f68166C4B2d9d0F049F33dEB399Daa1F",
    },
  },
  84532: {
    weth: "0x4200000000000000000000000000000000000006",
  },
};
