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


const main = async () => {
  await network.provider.send("evm_setAutomine", [false]);
  await network.provider.send("evm_setIntervalMining", [0]);
  

  
  
  [owner, maker1, maker2, user1, admin1, ...addrs] = await ethers.getSigners()

  const tpi = await deployContracts(owner)

  const txnStats = new TransactionStats('TestPriceIndex')
  let txn: any

  
  
  const errorIndex = BigNumber.from(15);

  let bitBucket: bigint = 0n
  let expect = errorIndex
  let result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
  if (!expect.eq(result))
    throw `getSmallestNonZeroBitIndex failed: result=${result}, expect=${expect}`;

  bitBucket = 2n**0n
  expect = BigNumber.from(0n)
  result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
  if (!expect.eq(result))
    throw `getSmallestNonZeroBitIndex failed: result=${result}, expect=${expect}`;
  
  bitBucket = 2n**1n
  expect = BigNumber.from(1n)
  result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
  if (!expect.eq(result))
    throw `getSmallestNonZeroBitIndex failed: result=${result}, expect=${expect}`;
  
  bitBucket = 2n**14n
  expect = BigNumber.from(14n)
  result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
  if (!expect.eq(result))
    throw `getSmallestNonZeroBitIndex failed: result=${result}, expect=${expect}`;
  
  bitBucket = 2n**15n
  expect = errorIndex
  result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
  if (!expect.eq(result))
    throw `getSmallestNonZeroBitIndex failed: result=${result}, expect=${expect}`;
    
  
  




};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error(error);
    process.exit(1);
  });
