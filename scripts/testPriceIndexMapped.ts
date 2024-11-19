require("dotenv").config();
import { BigNumber } from "@ethersproject/bignumber";   
import { writeFileSync } from "fs";

import { EthPoolMainnetInterface, loadEthPoolMainnetFixture } from "test/helpers/deployer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ContractReceipt, ContractTransaction, Signer } from "ethers";

import { TestPriceIndex, TestPriceIndex__factory } from "typechain-types";

import { ethers, network } from "hardhat"
import {Test} from "mocha";

import { getBlockNumber, mineBlocks, JSONBI } from "./utils/misc";
import { TransactionStats } from "./utils/transactionStats";


const ds = require("./utils/debugScopes");
const log = ds.getLog("runBenchmark");


let owner: SignerWithAddress, 
    admin1: SignerWithAddress,
    maker1: SignerWithAddress,
    maker2: SignerWithAddress,
    user1: SignerWithAddress,
    addrs: SignerWithAddress[];


const deployContracts = async (_owner: SignerWithAddress): Promise<TestPriceIndex> =>
{
  const tpi: TestPriceIndex = await new TestPriceIndex__factory(_owner).deploy();
  await mineBlocks()
  return tpi
}

