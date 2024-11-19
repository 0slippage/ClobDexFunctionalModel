require("dotenv").config();
import { BigNumber } from "@ethersproject/bignumber";   
import { writeFileSync } from "fs";

import { EthPoolMainnetInterface, loadEthPoolMainnetFixture } from "test/helpers/deployer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Signer } from "ethers";

import { Playground, Playground__factory } from "typechain-types";

import { ethers, network } from "hardhat"










const ds = require("./utils/debugScopes");
const log = ds.getLog("runPlayground");


const BENCHMARK_FILE = require("./../test/Benchmark-2022-04-13T10:23:04.582Z.tv.json");

let owner: SignerWithAddress, 
    addr1: SignerWithAddress,
    admin1: SignerWithAddress,
    addrs: SignerWithAddress[];


const getBlockNumber = async ():Promise<number> => 
{
  return Number(await network.provider.send("eth_blockNumber"));
}


type FnGasStat = {
  fn: string,
  calls: number,
  min: number,
  max: number,
  avg: number
}

class TransactionStats {
  constructor(aContractName: string) {
    this.contractName = aContractName
    this.transactions = []
    this.gasUsed = {}
  }

  clear = () => {
    this.transactions = []
  }

  addTransaction = (operation: string, transaction: any) => {
    this.transactions.push({operation, transaction})
  }

  processTransactions = async () => {

    for (const txn of this.transactions) {
      const { operation, transaction } = txn
      const receipt = await transaction.wait()
      const gasUsed: BigNumber = receipt.gasUsed
      if (gasUsed) {
        if (!this.gasUsed.hasOwnProperty(operation)) {
          this.gasUsed[operation] = []
        }
        this.gasUsed[operation].push(gasUsed.toNumber())
      }
    }

    this.clear()
  }

  getGasStats = (): FnGasStat[] => {
    const gasStats: FnGasStat[] = []

    for (const key in this.gasUsed) {
      const gasUsages: any[] = this.gasUsed[key]
      const avg = (gasUsages.reduce(
          (prev, curr) => { return prev + curr }, 0) / gasUsages.length);
      const min = (gasUsages.reduce(
        (prev, curr) => { return (prev === undefined || prev > curr) ? curr : prev}, undefined) ); 
      const max = (gasUsages.reduce(
        (prev, curr) => { return (prev === undefined || prev < curr) ? curr : prev}, undefined) );
      
      gasStats.push({ 
        fn: key, 
        calls: gasUsages.length,
        min: Math.round(min),
        max: Math.round(max),
        avg: Math.round(avg) })
    }

    return gasStats.sort((a: any, b: any) => {
      if (a.fn < b.fn) return -1
      else if (b.fn > a.fn) return 1
      return 0
    } )
  }

  getCSV = (): string =>
  {
    let csvStr = ''

    const gasStats = this.getGasStats()
    if (gasStats.length) {
      const header = Object.keys(gasStats[0]).join(", ")
      const data = gasStats.map((gasStat: FnGasStat) => {
        return Object.values(gasStat).join(", ")
      })
      
      csvStr += [header, ...data].join("\n")
    }

    return csvStr
  }

  writeToCSV = (date = new Date()): void =>
  {
    const gasStats = this.getGasStats()
    if (gasStats.length) {
      const csvData = this.getCSV()
      const filename = `bmk-gas__${this.contractName}__${date.toISOString()}.csv`
      writeFileSync(filename, csvData)
      log.warn(`Wrote CSV file ${filename}.`)
    } else {
      log.warn(`No CSV file written; no data to write!`)
    }
  }

  private contractName: string
  private transactions: any[]
  private gasUsed: any
}


async function mineBlocks(_options: {blocksToMine?: number, verbose?: boolean} = {}): Promise<number> {
  const options = {
    blocksToMine: 1,
    verbose: false,
    ... _options
  }

  const start = Number(await network.provider.send("eth_blockNumber"));

  for (let idx = 0; idx < options.blocksToMine; idx++) {
    await network.provider.send("evm_mine");
  }

  const end = Number(await network.provider.send("eth_blockNumber"));
  if (options.verbose) {
    console.log(`Mined ${options.blocksToMine} blocks (start=${start}, end=${end}, diff=${end-start})`)
  }

  return end
}

const configPlayground = async (): Promise<Playground> =>
{
  [owner, ...addrs] = await ethers.getSigners()

  const pgContract = await new Playground__factory(owner).deploy()
  await mineBlocks()

  return pgContract
}



















































































































































































































































































































































const main = async () => {
  await network.provider.send("evm_setAutomine", [false]);
  await network.provider.send("evm_setIntervalMining", [0]);

  const pgContract = await configPlayground()
  const txnStats = new TransactionStats('Playground')

  const totalPositions = 30


  
  
  for (let index = 0; index < totalPositions; index++) {
    
    const contractOrdinal = BigInt(index)
    const positionType = 0n       
    const price = 1000n
    const lot = 1n
    const currentTimestamp = 0n
    const deposit = 10n * (lot * price) / 100n

    
    
    let operation = 'insert'
    let txn: any = await pgContract[operation](contractOrdinal,
                                               positionType,
                                               price,
                                               currentTimestamp,
                                               deposit,
                                               lot)
    txnStats.addTransaction(operation, txn)

    await mineBlocks()
    await txnStats.processTransactions()
  }


  
  


  
  
  for (let index = 0; index < totalPositions; index++) {
    const contractOrdinal = BigInt(index)

    
    
    let operation = 'remove'
    let txn: any = await pgContract[operation](contractOrdinal)
    txnStats.addTransaction(operation, txn)

    await mineBlocks()
    await txnStats.processTransactions()
  }


  console.log(`Txn Data:\n` +
              `================================================================================\n` +
              txnStats.getCSV() +
              '\n')












  
  



















};


main()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error(error);
    process.exit(1);
  });
