import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-solhint";
import "@nomiclabs/hardhat-ganache";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "hardhat-docgen";
//import "@tenderly/hardhat-tenderly";
import "solidity-coverage";
import "@typechain/hardhat";
import "@typechain/ethers-v5";

import "dotenv/config.js";

import { HardhatUserConfig } from "hardhat/config";

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const GOERLI_RPC_URL = `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_KEY}`;
const ETHERSCAN_TOKEN =
  process.env.ETHERSCAN_API_KEY || "Your etherscan API key";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// This task ignores solidity test files needed for foundry from hardhat builds
// See more: https://github.com/NomicFoundation/hardhat/issues/2306#issuecomment-1039452928
const {subtask} = require("hardhat/config");
const {TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS} = require("hardhat/builtin-tasks/task-names")
subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS)
.setAction(async (_: any, __: any, runSuper: () => any) => {
  const paths = await runSuper();
  const filteredPaths = paths.filter((p: string) => {
    let includePath = !p.endsWith(".t.sol") && !p.endsWith(".s.sol")
    return includePath
  });
  return filteredPaths
});

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  typechain: {
    outDir: "typechain-types/",
    target: "ethers-v5",
    alwaysGenerateOverloads: true,
    externalArtifacts: ["externalArtifacts/*.json"],
  },
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 800,
          },
          viaIR: true,
          evmVersion: 'cancun' // Set Cancun as the default VM
        },
      }
    ],
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: true,
    runOnCompile: false,
    strict: false,
    only: []
  },
  networks: {
    hardhat: {
      // Massive limit for testing large scenarios:
      blockGasLimit: 300_000_000,
      allowUnlimitedContractSize: true,
      mining: {
        auto: false,
        interval: 0,
        mempool: {
          order: "fifo",
        },
      },
    },
    local: {
      allowUnlimitedContractSize: true,
      mining: {
        auto: false,
        interval: 0,
        mempool: {
          order: "fifo",
        },
      },
      url: "http://localhost:8545",
      // Massive timeout for testing long scenarios (gas measurement rpc times out otherwise)
      timeout: 120000,
    },
    goerli: {
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY ? PRIVATE_KEY : ""],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_TOKEN,
  },
  mocha: {
   timeout: 0,
   bail: true
  },
  docgen: {
    path: "./docs",
    clear: true,
    runOnCompile: false
  }
}

export default config;
