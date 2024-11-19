require("dotenv").config();
import { BigNumber } from "@ethersproject/bignumber";   
import { writeFileSync } from "fs";

import { EthPoolMainnetInterface, loadEthPoolMainnetFixture } from "test/helpers/deployer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ContractReceipt, ContractTransaction, Signer } from "ethers";

import { Vault__factory, Vault, TestToken__factory, TestToken } from "typechain-types";

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
    maker3: SignerWithAddress,
    maker4: SignerWithAddress,
    user1: SignerWithAddress,
    addrs: SignerWithAddress[];


const NULL_PRICE = BigNumber.from((2n**32n) - 2n);
function nullOrPrice(price: BigNumber): string {
  return (price.eq(NULL_PRICE)) ? "NULL" : price.toString();
}
async function printOrderBookSummary(vault: Vault, perpId: number, note?: string): Promise<void> {
  const {maxBidPrice, minBidPrice, maxAskPrice, minAskPrice, bookEntries} = 
    await vault.getContractBookSummary(perpId);

  const _note: string = (note === undefined) ? '' : note + '\n';
  log.debug('\n' +
            `Contract ${perpId} CLOB:\n` +
            _note +
            `................................................................................\n` +
            `maxAskPrice = ${nullOrPrice(maxAskPrice)}\n` +
            `minAskPrice = ${nullOrPrice(minAskPrice)}\n` +
            `maxBidPrice = ${nullOrPrice(maxBidPrice)}\n` +
            `minBidPrice = ${nullOrPrice(minBidPrice)}\n` +
            `Price\tBid\tAsk\n--------------------\n` +
            `${(bookEntries.join('\n')).replace(/,/g, '\t',)}\n\n`)
}


const USDT_SCALE = "000000"
const deployContracts = async (_owner: SignerWithAddress): Promise<{ vault: Vault,
                                                                     gusdToken: TestToken,
                                                                     usdtToken: TestToken,
                                                                     wbtcToken: TestToken,
                                                                     wethToken: TestToken }> =>
{
  const GUSD_DECIMALS = 2;
  const USDT_DECIMALS = 6;
  const WBTC_DECIMALS = 8;
  const WETH_DECIMALS = 18;

  const tokenFactory = new TestToken__factory(_owner);
  const gusdToken = await tokenFactory.deploy("GUSD", "GUSD", GUSD_DECIMALS);
  const usdtToken = await tokenFactory.deploy("USDT", "USDT", USDT_DECIMALS);
  const wbtcToken = await tokenFactory.deploy("WBTC", "WBTC", WBTC_DECIMALS);
  const wethToken = await tokenFactory.deploy("WETH", "WETH", WETH_DECIMALS);
  await mineBlocks()

  const ONE_MIL = "1000000" + USDT_SCALE;
  const ONE_BIL = "1000000000" + USDT_SCALE;
  const GUSD_SUPPLY = ethers.utils.parseUnits(ONE_BIL, GUSD_DECIMALS);
  const USDT_SUPPLY = ethers.utils.parseUnits(ONE_BIL, USDT_DECIMALS);
  const WBTC_SUPPLY = ethers.utils.parseUnits(ONE_MIL, WBTC_DECIMALS);
  const WETH_SUPPLY = ethers.utils.parseUnits(ONE_BIL, WETH_DECIMALS);
  gusdToken.connect(owner).mint(owner.address, GUSD_SUPPLY);
  usdtToken.connect(owner).mint(owner.address, USDT_SUPPLY);
  wbtcToken.connect(owner).mint(owner.address, WBTC_SUPPLY);
  wethToken.connect(owner).mint(owner.address, WETH_SUPPLY);
  await mineBlocks()

  const vault: Vault = await new Vault__factory(_owner).deploy(_owner.address, usdtToken.address)
  await mineBlocks()

  return { vault, gusdToken, usdtToken, wbtcToken, wethToken }
}

const main = async () => {
  await network.provider.send("evm_setAutomine", [false]);
  await network.provider.send("evm_setIntervalMining", [0]);
  

  
  
  [owner, maker1, maker2, maker3, maker4, user1, admin1, ...addrs] = await ethers.getSigners()

  const contracts = await deployContracts(owner)
  const { vault, usdtToken } = contracts;

  const txnStats = new TransactionStats('Vault')
  let txn: any

  
  
  const perpId = 0;
  await vault.connect(owner).addContract("BTC USDT Perp.", "BTC-USDT", perpId, 0, 0);
  await vault.connect(owner).togglePauseContract(perpId);
  await mineBlocks();

  
  
  
  const {name, symbol, indexFP, markFP, openInterest, paused} = await vault.getContractInfo(perpId);
  log.debug(`Perp contract ${perpId} info:\n${name}, ${symbol}\n`);
  await printOrderBookSummary(vault, perpId, 'After adding perp. contract (empty book).');

  
  
  const USDT_DECIMALS = BigNumber.from(await usdtToken.decimals());
  const HUNDRED_K = "100000" + USDT_SCALE;
  const USER_USDT_AMT = ethers.utils.parseUnits(HUNDRED_K, USDT_DECIMALS);
  await usdtToken.connect(owner).transfer(maker1.address, USER_USDT_AMT);
  await usdtToken.connect(owner).transfer(maker2.address, USER_USDT_AMT);
  await usdtToken.connect(owner).transfer(maker3.address, USER_USDT_AMT);
  await usdtToken.connect(owner).transfer(maker4.address, USER_USDT_AMT);
  await usdtToken.connect(owner).transfer(user1.address, USER_USDT_AMT);
  await mineBlocks()


  
  
  
  const TEN_K = "10000" + USDT_SCALE;
  const INIT_DEPOSIT = ethers.utils.parseUnits(TEN_K, USDT_DECIMALS);
  await usdtToken.connect(maker1).approve(vault.address, INIT_DEPOSIT);
  txn = await vault.connect(maker1).createAccount(INIT_DEPOSIT);
  txnStats.addTransaction('createAccount', txn);
  
  await usdtToken.connect(maker2).approve(vault.address, INIT_DEPOSIT);
  txn = await vault.connect(maker2).createAccount(INIT_DEPOSIT);
  txnStats.addTransaction('createAccount', txn);
  
  await usdtToken.connect(maker3).approve(vault.address, INIT_DEPOSIT);
  txn = await vault.connect(maker3).createAccount(INIT_DEPOSIT);
  txnStats.addTransaction('createAccount', txn);

  await usdtToken.connect(maker4).approve(vault.address, INIT_DEPOSIT);
  txn = await vault.connect(maker4).createAccount(INIT_DEPOSIT);
  txnStats.addTransaction('createAccount', txn);

  await usdtToken.connect(user1).approve(vault.address, INIT_DEPOSIT);
  txn = await vault.connect(user1).createAccount(INIT_DEPOSIT);
  txnStats.addTransaction('createAccount', txn);
  await mineBlocks()
  await txnStats.processTransactions()

  


  
  
  
  
  const NO_TIF = 0    
  let basePrice = 10000_00
  let orderType = 0 
  let priceFP = basePrice 
  let lotFP = 10_00 
  for (; priceFP > basePrice - 6; priceFP--) {
    lotFP += 1_00;
    txnStats.addTransaction('limitOrder',
                            await vault.connect(maker1).limitOrder(perpId, orderType, priceFP, lotFP, NO_TIF))
  }

  orderType = 1 
  priceFP = basePrice + 2
  lotFP = 10_00 
  for (; priceFP <= basePrice + 6; priceFP++) {
    lotFP += 1_00;
    txnStats.addTransaction('limitOrder',
                            await vault.connect(maker2).limitOrder(perpId, orderType, priceFP, lotFP, NO_TIF))

    
    if (priceFP == basePrice + 6) {
      lotFP += 1_00;
      txnStats.addTransaction('limitOrder',
                              await vault.connect(maker2).limitOrder(perpId, orderType, priceFP, lotFP, NO_TIF))
    }
  }
  await mineBlocks()

  
  
  await printOrderBookSummary(vault, perpId, 'After makers provide inventory.');

  
  
  
  
  let txnRcts: ContractReceipt[] = await txnStats.processTransactions()
  
  
  
  
  
  
  
  const lastRctIdx = txnRcts.length - 1;
  const lastRct = txnRcts[lastRctIdx]
  const orderPlacedEvt = (lastRct.events) ? lastRct.events[0] : undefined
  const orderSignature: BigNumber = (orderPlacedEvt &&
                                     orderPlacedEvt.args &&
                                     orderPlacedEvt.args.length >= 3) ? orderPlacedEvt.args[2] : undefined
  const orderSignatureBI = orderSignature.toBigInt()

  const ORDER_ID_BITS = 40n
  const orderId = orderSignatureBI & (2n ** ORDER_ID_BITS - 1n)
  const orderPriceFP = orderSignatureBI >> ORDER_ID_BITS
  



  
  
  
  txn = await vault.connect(maker2).cancelOrder(perpId, orderSignature)
  txnStats.addTransaction('cancelOrder', txn);
  await mineBlocks()
  await txnStats.processTransactions()
  
  
  
  await printOrderBookSummary(vault, perpId, 'After deleting order.');


  
  
  orderType = 0 
  lotFP = 32_00
  txn = await vault.connect(user1).marketOrder(perpId, orderType, lotFP)
  txnStats.addTransaction('marketOrder', txn)
  await mineBlocks()
  await txnStats.processTransactions()
  
  
  
  await printOrderBookSummary(vault, perpId, `After matching a market order (open long, lot=${lotFP})`);
  
  orderType = 1 
  lotFP = 12_00
  txn = await vault.connect(user1).marketOrder(perpId, orderType, lotFP)
  txnStats.addTransaction('marketOrder', txn)
  await mineBlocks()
  await txnStats.processTransactions()

  
  
  await printOrderBookSummary(vault, perpId, `After matching a market order (open short, lot=${lotFP})`);

  


  
  

  
  























  
  
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
