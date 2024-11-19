import { BigNumber } from "@ethersproject/bignumber";   
import { writeFileSync } from "fs";

import { ContractReceipt, ContractTransaction, Signer } from "ethers";


const ds = require("./debugScopes");
const log = ds.getLog("txnStats");



export type FnGasStat = {
  fn: string,
  calls: number,
  min: number,
  max: number,
  avg: number
}

export class TransactionStats {
  constructor(aContractName: string) {
    this.contractName = aContractName
    this.transactions = []
    this.gasUsed = {}
  }

  clear = () => {
    this.transactions = []
  }

  addTransaction = (operation: string, transaction: ContractTransaction) => {
    this.transactions.push({operation, transaction})
  }

  processTransactions = async (): Promise<ContractReceipt[]> => {
    const receipts: ContractReceipt[] = [];

    for (const txn of this.transactions) {
      const { operation, transaction } = txn
      const receipt = await transaction.wait()
      receipts.push(receipt)
      const gasUsed: BigNumber = receipt.gasUsed
      if (gasUsed) {
        if (!this.gasUsed.hasOwnProperty(operation)) {
          this.gasUsed[operation] = []
        }
        this.gasUsed[operation].push(gasUsed.toNumber())
      }
    }

    this.clear()

    return receipts;
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
  private transactions: {operation: string, transaction: ContractTransaction}[]
  private gasUsed: any
}

