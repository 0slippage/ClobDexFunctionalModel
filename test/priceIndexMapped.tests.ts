require("dotenv").config();

import { ethers, waffle, network } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ContractReceipt, ContractTransaction, Signer } from "ethers";

import { expect } from "chai"
import { Test } from "mocha";

import { BigNumber } from "@ethersproject/bignumber";   // TODO: difference between this and import from ethers?

import { TestPriceIndex, TestPriceIndex__factory } from "typechain-types";

import { createSnapshot, restoreSnapshot } from "./helpers/snapshots"

import { getBlockNumber, mineBlocks, JSONBI } from "./../scripts/utils/misc";
import { TransactionStats } from "./../scripts/utils/transactionStats";
import exp from "constants";


const ds = require("./../scripts/utils/debugScopes");
const log = ds.getLog("priceIndexMapped.tests");

const decimalScaling = 2n
const basePriceScaled = 30_000n * (10n ** decimalScaling)
const maxPriceScaled = basePriceScaled + (15n ** 6n) -1n

const deployContracts = async (): Promise<{ tpi: TestPriceIndex,
                                            owner: SignerWithAddress,
                                            addrs: SignerWithAddress[] }> =>
{
  const [owner, ...addrs] = await ethers.getSigners()
  const tpi: TestPriceIndex = await new TestPriceIndex__factory(owner).deploy(basePriceScaled, decimalScaling);
  await mineBlocks()
  return { tpi, owner, addrs }
}

describe("Mapped Price Index Tree Test Suite", function() {
  let owner: SignerWithAddress, addrs: SignerWithAddress[];
  let tpi: TestPriceIndex
  const bid = true;
  const ask = !bid;

  before(async function () 
  {
    await createSnapshot(waffle.provider);
    const result = await deployContracts();
    owner = result.owner
    addrs = result.addrs
    tpi = result.tpi
  })

  after(function () {
    restoreSnapshot(waffle.provider);
  })


  describe("Price Index Feature Tests", function() {
    const BUCKET_WIDTH = 15n
    const CHILD_OFFSET = 1n * BUCKET_WIDTH

    // Need the before each / after each because state writes in each test affect
    // follow on tests otherwise (hence save/restore).
    beforeEach(async function () 
    {
      await createSnapshot(waffle.provider);
      const result = await deployContracts();
      owner = result.owner
      addrs = result.addrs
      tpi = result.tpi
    })

    afterEach(function () {
      restoreSnapshot(waffle.provider);
    })

    describe("Add Price Tests", function() {
      it ("Should fail to add price 0", async function() {
        const decimalNum = 0;
        let errorReason 
        try {
          await tpi.addPrice(decimalNum, bid)
        } catch (error: any) {
          errorReason = error.reason
        }
        expect(errorReason).to.contain("ScaledPriceOutOfBounds(0, 3000000, 14390624)")
      })

      it ("Should fail to add price 1", async function() {
        const decimalNum = 1;
        let errorReason 
        try {
          await tpi.addPrice(decimalNum, bid)
        } catch (error: any) {
          errorReason = error.reason
        }
        expect(errorReason).to.contain("ScaledPriceOutOfBounds(1, 3000000, 14390624)")
      })
      
      it ("Should correctly add the base price", async function() {
        const decimalNum = basePriceScaled;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const unmappedDecimalNum = decimalNum - basePriceScaled
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add 13, offset by the base price scaled", async function() {
        const decimalNum = basePriceScaled + 13n;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const unmappedDecimalNum = decimalNum - basePriceScaled
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**0n +                                        // Root Level
                            ((2n**13n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add 14, offset by the base price scaled", async function() {
        const decimalNum = basePriceScaled + 14n;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const unmappedDecimalNum = decimalNum - basePriceScaled
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**0n +                                        // Root Level
                            ((2n**14n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add base prices plus 0 and 1, offset by the base price scaled", async function() {
        let decimalNumP0 = basePriceScaled + 0n;
        await tpi.addPrice(decimalNumP0, bid)
        let decimalNumP1 = basePriceScaled + 1n;
        await tpi.addPrice(decimalNumP1, bid)
        await mineBlocks()

        const unmappedDecimalNum = decimalNumP0 - basePriceScaled

        // Can do this b/c both prices in same slots:
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**0n +                                        // Root Level
                            ((2n**1n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH)) +  // Level 1 
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add prices 0, 1, 7, 13 and 14, offset by the base price scaled", async function() {
        let decimalNum
        let promises = []
        for (decimalNum of [0n, 1n, 7n, 13n, 14n]) {
          promises.push(tpi.addPrice(decimalNum + basePriceScaled, bid))
        }
        await Promise.all(promises)
        await mineBlocks()

        const unmappedDecimalNum = 0n

        // Can do this b/c all prices in same slots:
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**0n +                                        // Root Level
                            ((2n** 0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH)) +  // Level 1 
                            ((2n** 1n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH)) +  // Level 1 
                            ((2n** 7n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH)) +  // Level 1 
                            ((2n**13n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH)) +  // Level 1 
                            ((2n**14n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add the price 15, offset by the base price scaled", async function() {
        const decimalNum = basePriceScaled + 15n;

        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const unmappedDecimalNum = decimalNum - basePriceScaled
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**1n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 1n*BUCKET_WIDTH))    // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add the price 210, offset by the base price scaled", async function() {
        const decimalNum = basePriceScaled + 210n;   // 0000E0
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const unmappedDecimalNum = decimalNum - basePriceScaled
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**14n +                                       // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH))   // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add the prices 0, 195 and 210, offset by the base price scaled", async function() {
        let decimalNum = basePriceScaled + 0n;   // 000000
        await tpi.addPrice(decimalNum, bid)
        decimalNum = basePriceScaled + 195n;     // 0000D0
        await tpi.addPrice(decimalNum, bid)
        decimalNum = basePriceScaled + 210n;     // 0000E0
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const unmappedDecimalNum = 0n
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                         // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))     // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                         // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))     // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**14n +                                        // Root Level
                              2n**13n +                                        // Root Level
                              2n** 0n +                                        // Root Level
                            ((2n** 0n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH)) + // Level 1 
                            ((2n** 0n) << (CHILD_OFFSET + 13n*BUCKET_WIDTH)) + // Level 1 
                            ((2n** 0n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))   // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add the prices 0, 15, 30, 45, 60 ..., 210, offset by the base price scaled", async function() {

        let promises = []
        let decimalNum = 0n;
        promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        do {
          decimalNum += 15n
          promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        } while (decimalNum < 210n)

        await Promise.all(promises)
        await mineBlocks()

        const unmappedDecimalNum = 0n
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot = ((2n**15n)-1n) +                                 // Root Level (every bit)
                            ((2n**0n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET + 13n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET + 12n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET + 11n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET + 10n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET +  9n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET +  8n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET +  7n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET +  6n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET +  5n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET +  4n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET +  3n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET +  2n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**0n) << (CHILD_OFFSET +  1n*BUCKET_WIDTH)) +  // Level 1, Bucket 1 
                            ((2n**0n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1, Bucket 0
        expect(bottom).to.equal(expectedBot)
      })

      it ("Should correctly add the price 11390624 offset by the base price scaled", async function() {
        const decimalNum = basePriceScaled + 11390624n;  // 11390624 -> EEEEEE base15
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const unmappedDecimalNum = decimalNum - basePriceScaled
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**14n +                                        // Root Level
                            ((2n**14n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH))   // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**14n +                                        // Root Level
                            ((2n**14n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH))   // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**14n +                                        // Root Level
                            ((2n**14n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH))   // Level 1 
        expect(bottom).to.equal(expectedBot)
      })

      it ("Should correctly add the prices 11390410, 11390425, ... 11390620 offset by the base price scaled", async function() {

        let promises = []
        let decimalNum = 11390410n  // EEEE0A
        promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        do {
          decimalNum += 15n
          promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        } while (decimalNum < 11390620n)
        
        await Promise.all(promises)
        await mineBlocks()

        const unmappedDecimalNum = 11390410n
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**14n +                                        // Root Level
                            ((2n**14n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH))   // Level 1 
        const expectedMid =   2n**14n +                                        // Root Level
                            ((2n**14n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH))   // Level 1 

        const expectedBot = ((2n**15n)-1n) +                                   // Root Level (every bit)
                            ((2n**10n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET + 13n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET + 12n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET + 11n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET + 10n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET +  9n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET +  8n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET +  7n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET +  6n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET +  5n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET +  4n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET +  3n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET +  2n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**10n) << (CHILD_OFFSET +  1n*BUCKET_WIDTH)) +  // Level 1, Bucket 1 
                            ((2n**10n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1, Bucket 0

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
      })
    })
    
    describe ("Remove Price Tests", function() {
      it ("Should correctly remove price 0, offset by the base price scaled", async function() {
        const decimalNum = basePriceScaled + 0n;

        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        await tpi.removePrice(decimalNum, bid)
        await mineBlocks()
        
        
        const unmappedDecimalNum = decimalNum - basePriceScaled
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop = 0n
        const expectedMid = 0n
        const expectedBot = 0n

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly remove ONLY price basePriceScaled+0 then only price basePriceScaled+8 after adding prices 0, 4, 8 & 12, offset by basePriceScaled", async function() {

        let promises = []
        let decimalNum = 0n
        promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        do {
          decimalNum += 4n
          promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        } while (decimalNum < 12n)
        
        await Promise.all(promises)
        await mineBlocks()


        await tpi.removePrice(basePriceScaled + 0n, bid)
        await mineBlocks()
        
        // Slots should match after removing price 0
        //
        let unmappedDecimalNum = 0n
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
        let { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =  (2n** 0n) +                                        // Root Level
                            ((2n** 0n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1 

        const expectedMid =  (2n** 0n) +                                        // Root Level
                            ((2n** 0n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1 

        let expectedBot =    (2n** 0n) +                                        // Root Level (every bit)
                            ((2n**12n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n** 8n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n** 4n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1, Bucket 0

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
        

        await tpi.removePrice(basePriceScaled + 8n, bid)
        await mineBlocks()
        
        // Slots should match after removing price 8
        //
        const result = await tpi.getPriceSlots(bcb15Num)
        top = result.top
        middle = result.middle
        bottom = result.bottom
        
        expectedBot =        (2n** 0n) +                                        // Root Level (every bit)
                            ((2n**12n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n** 4n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1, Bucket 0

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
      })

      it ("Should correctly remove ONLY price 20, then price 95, then 215, after adding prices 5, 20, 35 ... 215 (all prices offset by basePriceScaled)", async function() {

        let promises = []
        let decimalNum = 5n
        promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        do {
          decimalNum += 15n
          promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        } while (decimalNum < 215n)
        
        await Promise.all(promises)
        await mineBlocks()


        await tpi.removePrice(basePriceScaled + 20n, bid)
        await mineBlocks()
        
        // Slots should match after removing price 20
        //
        let unmappedDecimalNum = 20n
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        let { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =  (2n** 0n) +                                        // Root Level
                            ((2n** 0n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1 

        const expectedMid =  (2n** 0n) +                                        // Root Level
                            ((2n** 0n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1 

        let expectedBot =   ((2n**15n)-1n) +                                   // Root Level (every bit)
                            -(2n** 1n) +                                       // minus bit index 1
                            ((2n**5n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 13n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 12n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 11n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 10n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  9n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  8n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  7n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  6n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  5n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  4n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  3n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  2n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1, Bucket 0

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
        

        await tpi.removePrice(basePriceScaled + 95n, bid)
        await mineBlocks()
        
        // Slots should match after removing price 95
        //
        let result = await tpi.getPriceSlots(bcb15Num)
        top = result.top
        middle = result.middle
        bottom = result.bottom
        
        expectedBot =       ((2n**15n)-1n) +                                   // Root Level (every bit)
                            -(2n** 1n) +                                       // minus bit index 1
                            -(2n** 6n) +                                       // minus bit index 6
                            ((2n**5n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 13n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 12n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 11n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 10n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  9n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  8n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  7n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  5n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  4n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  3n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  2n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1, Bucket 0

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)


        await tpi.removePrice(basePriceScaled + 215n, bid)
        await mineBlocks()
        
        // Slots should match after removing price 215
        //
        result = await tpi.getPriceSlots(bcb15Num)
        top = result.top
        middle = result.middle
        bottom = result.bottom
        
        expectedBot =       ((2n**15n)-1n) +                                   // Root Level (every bit)
                            -(2n** 1n) +                                       // minus bit index 1
                            -(2n** 6n) +                                       // minus bit index 6
                            -(2n**14n) +                                       // minus bit index 14
                            ((2n**5n) << (CHILD_OFFSET + 13n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 12n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 11n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET + 10n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  9n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  8n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  7n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  5n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  4n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  3n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  2n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**5n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1, Bucket 0

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
      })

      it ("Should correctly remove price base price scaled + 11390620", async function() {
        const decimalNum = basePriceScaled + 11390620n;  // EEEEEE base15

        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        await tpi.removePrice(decimalNum, bid)
        await mineBlocks()

        
        const unmappedDecimalNum = decimalNum - basePriceScaled
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(unmappedDecimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)
        
        const expectedTop = 0n
        const expectedMid = 0n
        const expectedBot = 0n

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly remove only prices 11390474 & 11390549 after adding 11390414, 11390429, ... 11390624 (all ofset by basePriceScaled)", async function() {
        
        let promises = []
        let decimalNum = 11390414n   // EEEE0E base15
        promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        do {
          decimalNum += 15n
          promises.push(tpi.addPrice(basePriceScaled + decimalNum, bid))
        } while (decimalNum < 11390624n /* EEEEEE base15 */ )
        
        await Promise.all(promises)
        await mineBlocks()

        await tpi.removePrice(basePriceScaled + 11390474n, bid)
        await tpi.removePrice(basePriceScaled + 11390549n, bid)
        await mineBlocks()

        
        let unmappedDecimalNum = 11390414n
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)
        
        const expectedTop =  (2n**14n) +                                        // Root Level
                            ((2n**14n) << (CHILD_OFFSET +  14n*BUCKET_WIDTH))    // Level 1 

        const expectedMid =  (2n**14n) +                                        // Root Level
                            ((2n**14n) << (CHILD_OFFSET +  14n*BUCKET_WIDTH))    // Level 1 

        const expectedBot = ((2n**15n)-1n) +                                    // Root Level (every bit)
                            -(2n** 9n) +                                        // minus bit index 9
                            -(2n** 4n) +                                        // minus bit index 4
                            ((2n**14n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET + 13n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET + 12n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET + 11n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET + 10n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET +  8n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET +  7n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET +  6n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET +  5n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET +  3n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET +  2n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET +  1n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**14n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1, Bucket 0

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
      })
    })
    
    describe ("Get Nearest Price Tests", function() {
      const UNDEF_PRICE = (2**32 - 2)
      const ABOVE = true
      const BELOW = !ABOVE
      const MAX_PRICE = Number.parseInt("EEEEEE", 15)
      
      it ("Should throw ScaledPriceOutOfBounds when the price tree is empty and the search price is out of bounds", async function() {
        try {
          let nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled - 1n, ABOVE)
        } catch (error: any) {
          expect(error.errorName).to.contain("ScaledPriceOutOfBounds")
        }
        
        try {
          let nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled - 1n, BELOW)
        } catch (error: any) {
          expect(error.errorName).to.contain("ScaledPriceOutOfBounds")
        }

        try {
          let nearestPrice = await tpi.getNearestPriceExternal(maxPriceScaled + 1n, ABOVE)
        } catch (error: any) {
          expect(error.errorName).to.contain("ScaledPriceOutOfBounds")
        }

        try {
          let nearestPrice = await tpi.getNearestPriceExternal(maxPriceScaled + 1n, BELOW)
        } catch (error: any) {
          expect(error.errorName).to.contain("ScaledPriceOutOfBounds")
        }
      })

      it ("Should return undef price when the price tree is empty (offset by basePriceScaled)", async function() {
        let nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 0n, ABOVE)
        expect(nearestPrice).to.equal(UNDEF_PRICE)
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 0n, BELOW)
        expect(nearestPrice).to.equal(UNDEF_PRICE)
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 1n, ABOVE)
        expect(nearestPrice).to.equal(UNDEF_PRICE)
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 1n, BELOW)
        expect(nearestPrice).to.equal(UNDEF_PRICE)
      })
      
      it ("Should return undef price searching and no price in above direction (offset by basePriceScaled)", async function() {
        await tpi.addPrice(basePriceScaled + 0n, bid)
        await mineBlocks()
        
        let nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 1n, ABOVE)
        expect(nearestPrice).to.equal(UNDEF_PRICE)
      })
      
      it ("Should return undef price searching and no price in below direction (offset by basePriceScaled)", async function() {
        await tpi.addPrice(basePriceScaled + BigInt(MAX_PRICE), bid)
        await mineBlocks()
        
        let nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + BigInt(MAX_PRICE) - 1n, BELOW)
        expect(nearestPrice).to.equal(UNDEF_PRICE)
      })

      it ("Should return price if searching that price in either search direction (offset by basePriceScaled)", async function() {
        const price = basePriceScaled + BigInt(Math.floor(MAX_PRICE / 2))
        await tpi.addPrice(price, bid)
        await mineBlocks()
        
        let nearestPrice = await tpi.getNearestPriceExternal(price, BELOW)
        expect(nearestPrice).to.equal(Number(price))
        
        nearestPrice = await tpi.getNearestPriceExternal(price, ABOVE)
        expect(nearestPrice).to.equal(Number(price))

        // Add more prices near and try again:
        //
        await Promise.all([tpi.addPrice(price-2n, bid),
                           tpi.addPrice(price-1n, bid),
                           tpi.addPrice(price+1n, bid),
                           tpi.addPrice(price+2n, bid)])
        await mineBlocks()
        
        nearestPrice = await tpi.getNearestPriceExternal(price, BELOW)
        expect(nearestPrice).to.equal(Number(price))
        
        nearestPrice = await tpi.getNearestPriceExternal(price, ABOVE)
        expect(nearestPrice).to.equal(Number(price))
      })

      it ("Should return 0 if only price for prices above or 0 and search direction below (offset by basePriceScaled)", async function() {
        await tpi.addPrice(basePriceScaled + 0n, bid)
        await mineBlocks()

        let nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 0n, BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 0n))

        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 1n, BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 0n))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 2n, BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 0n))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + BigInt(MAX_PRICE-1), BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 0n))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + BigInt(MAX_PRICE), BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 0n))
      })
      
      it ("Should return 1 if only prices 0 & 1 for prices above 0 and search direction below (offset by basePriceScaled)", async function() {
        await tpi.addPrice(basePriceScaled + 0n, bid)
        await tpi.addPrice(basePriceScaled + 1n, bid)
        await mineBlocks()

        let nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 1n, BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 1n))

        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 2n, BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 1n))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + BigInt(Math.floor(MAX_PRICE / 2)), BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 1n))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + BigInt(MAX_PRICE-1), BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 1n))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + BigInt(MAX_PRICE), BELOW)
        expect(nearestPrice).to.equal(Number(basePriceScaled + 1n))
      })
      
      it ("Should return MAX_PRICE if only price for prices below or MAX_PRICE and search direction above (offset by basePriceScaled)", async function() {
        await tpi.addPrice(basePriceScaled + BigInt(MAX_PRICE), bid)
        await mineBlocks()

        let nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + BigInt(MAX_PRICE), ABOVE)
        expect(nearestPrice).to.equal(Number(basePriceScaled + BigInt(MAX_PRICE)))

        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + BigInt(MAX_PRICE-1), ABOVE)
        expect(nearestPrice).to.equal(Number(basePriceScaled + BigInt(MAX_PRICE)))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + BigInt(MAX_PRICE-2), ABOVE)
        expect(nearestPrice).to.equal(Number(basePriceScaled + BigInt(MAX_PRICE)))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 0n +1n, ABOVE)
        expect(nearestPrice).to.equal(Number(basePriceScaled + BigInt(MAX_PRICE)))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 0n, ABOVE)
        expect(nearestPrice).to.equal(Number(basePriceScaled + BigInt(MAX_PRICE)))
      })
      
      it ("Should return MAX_PRICE-1 if only prices MAX_PRICE & MAX_PRICE-1 for prices below MAX_PRICE and search direction above (offset by basePriceScaled)", async function() {
        const mappedMaxPrice = basePriceScaled + BigInt(MAX_PRICE)
        await tpi.addPrice(mappedMaxPrice-1n, bid)
        await tpi.addPrice(mappedMaxPrice, bid)
        await mineBlocks()

        let nearestPrice = await tpi.getNearestPriceExternal(mappedMaxPrice-1n, ABOVE)
        expect(nearestPrice).to.equal(Number(mappedMaxPrice-1n))

        nearestPrice = await tpi.getNearestPriceExternal(mappedMaxPrice-2n, ABOVE)
        expect(nearestPrice).to.equal(Number(mappedMaxPrice-1n))
        
        nearestPrice = await tpi.getNearestPriceExternal(mappedMaxPrice / 2n, ABOVE)
        expect(nearestPrice).to.equal(Number(mappedMaxPrice-1n))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 1n, ABOVE)
        expect(nearestPrice).to.equal(Number(mappedMaxPrice-1n))
        
        nearestPrice = await tpi.getNearestPriceExternal(basePriceScaled + 0n, ABOVE)
        expect(nearestPrice).to.equal(Number(mappedMaxPrice-1n))
      })
    })
    
    describe("Crosses Book, Update Min/Max, Get Highest Bid and Get Lowest Ask Tests", function() {
      const UNDEF_PRICE = (2**32 - 2)
      const ABOVE = true
      const BELOW = !ABOVE
      const MAX_PRICE = Number.parseInt("EEEEEE", 15)

      it ("Should behave correctly when the index is empty (offset by basePriceScaled)", async function() {
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)

        let isBid = true;
        const mappedMinPrice = basePriceScaled + 0n
        const mappedMaxPrice = basePriceScaled + BigInt(MAX_PRICE)
        expect(await tpi.crossesBook(isBid, mappedMinPrice)).to.equal(false)
        expect(await tpi.crossesBook(isBid, mappedMaxPrice)).to.equal(false)

        isBid = false;
        expect(await tpi.crossesBook(isBid, mappedMinPrice)).to.equal(false)
        expect(await tpi.crossesBook(isBid, mappedMaxPrice)).to.equal(false)
      })


      it ("Should behave accordingly when a bid price is added (offset by basePriceScaled)", async function() {
        const mappedBidPrice = Number(basePriceScaled) + 1000
        await tpi.addPrice(mappedBidPrice, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice)

        // Bid prices should not cross the book no matter what (there is no ask price yet)
        const mappedBidPriceLo = mappedBidPrice - 1;
        const mappedBidPriceHi = mappedBidPrice + 1;
        expect(await tpi.crossesBook(bid, mappedBidPriceLo)).to.equal(false);
        expect(await tpi.crossesBook(bid, mappedBidPrice)).to.equal(false);
        expect(await tpi.crossesBook(bid, mappedBidPriceHi)).to.equal(false);

        // Crossing ask prices should cross, non-crossing should not:
        const askPriceCrossing = mappedBidPrice - 1;
        const askPriceCrossing2 = mappedBidPrice;
        const askPriceNotCrossing = mappedBidPrice +1;
        expect(await tpi.crossesBook(ask, askPriceCrossing)).to.equal(true);
        expect(await tpi.crossesBook(ask, askPriceCrossing2)).to.equal(true);
        expect(await tpi.crossesBook(ask, askPriceNotCrossing)).to.equal(false);
      })
      
      it ("Should behave accordingly when multiple bid prices are added in descending order (offset by basePriceScaled)", async function() {
        const mappedBidPriceHi = Number(basePriceScaled) + 1000
        const mappedBidPriceLo = Number(basePriceScaled) + 999
        await tpi.addPrice(mappedBidPriceHi, bid)
        await tpi.addPrice(mappedBidPriceLo, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPriceLo)
        
        // Bid prices should not cross the book no matter what (there is no ask price yet)
        const bidPriceLowest = mappedBidPriceLo - 1;
        const bidPriceHighest = mappedBidPriceHi + 1;
        expect(await tpi.crossesBook(bid, bidPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPriceHighest)).to.equal(false);

        // Crossing ask prices should cross, non-crossing should not:
        const askPriceCrossing = mappedBidPriceHi - 1;
        const askPriceCrossing2 = mappedBidPriceHi;
        const askPriceNotCrossing = mappedBidPriceHi + 1;
        expect(await tpi.crossesBook(ask, askPriceCrossing)).to.equal(true);
        expect(await tpi.crossesBook(ask, askPriceCrossing2)).to.equal(true);
        expect(await tpi.crossesBook(ask, askPriceNotCrossing)).to.equal(false);
      })

      it ("Should behave accordingly when multiple bid prices are added in ascending order (offset by basePriceScaled)", async function() {
        const mappedBidPriceLo = Number(basePriceScaled) + 999
        const mappedBidPriceHi = Number(basePriceScaled) + 1000
        await tpi.addPrice(mappedBidPriceLo, bid)
        await tpi.addPrice(mappedBidPriceHi, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPriceLo)
      })

      it ("Should behave accordingly when a bid price is added then removed (offset by basePriceScaled)", async function() {
        const mappedBidPrice = Number(basePriceScaled) + 1000
        await tpi.addPrice(mappedBidPrice, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice)
        
        await tpi.removePrice(mappedBidPrice, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        
        // Bid prices should not cross the book no matter what (there is no ask price yet)
        const bidPriceLowest = mappedBidPrice - 1;
        const bidPriceHighest = mappedBidPrice + 1;
        expect(await tpi.crossesBook(bid, bidPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPriceHighest)).to.equal(false);

        // Crossing ask prices should not cross the book when empty:
        const askPriceNotCrossing = mappedBidPrice - 1;
        const askPriceNotCrossing2 = mappedBidPrice;
        const askPriceNotCrossing3 = mappedBidPrice + 1;
        expect(await tpi.crossesBook(ask, askPriceNotCrossing)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceNotCrossing2)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceNotCrossing3)).to.equal(false);
      })
      
      it ("Should behave accordingly when a sequence of bid prices is added then removed (offset by basePriceScaled)", async function() {
        let mappedBidPrice1000 = Number(basePriceScaled) + 1000
        await tpi.addPrice(mappedBidPrice1000, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice1000)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice1000)
        
        
        let mappedBidPrice1001 = Number(basePriceScaled) + 1001
        await tpi.addPrice(mappedBidPrice1001, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice1001)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice1000)


        let mappedBidPrice1002 = Number(basePriceScaled) + 1002
        await tpi.addPrice(mappedBidPrice1002, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice1002)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice1000)
        

        await tpi.removePrice(mappedBidPrice1001, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice1002)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice1000)
        

        await tpi.removePrice(mappedBidPrice1000, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice1002)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice1002)
        

        await tpi.removePrice(mappedBidPrice1002, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
      })

      it ("Should behave accordingly when a bid of 0 is added and removed (offset by basePriceScaled)", async function() {
        const mappedBidPrice0 = Number(basePriceScaled) + 0
        await tpi.addPrice(mappedBidPrice0, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice0)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice0)
        

        const mappedBidPrice1 = Number(basePriceScaled) + 1
        await tpi.addPrice(mappedBidPrice1, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice1)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice0)
        

        await tpi.removePrice(mappedBidPrice1, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPrice0)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPrice0)
        

        await tpi.removePrice(mappedBidPrice0, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
      })


      it ("Should behave accordingly when an ask price is added (offset by basePriceScaled)", async function() {
        const mappedAskPrice = Number(basePriceScaled) + 1000
        await tpi.addPrice(mappedAskPrice, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        
        // Ask prices should not cross the book no matter what (there is no bid price yet)
        const askPriceLowest = mappedAskPrice - 1;
        const askPriceHighest = mappedAskPrice + 1;
        expect(await tpi.crossesBook(ask, askPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceHighest)).to.equal(false);

        // Crossing bid prices should cross, non-crossing should not:
        const bidPriceCrossing = mappedAskPrice + 1;
        const bidPriceCrossing2 = mappedAskPrice;
        const bidPriceNotCrossing = mappedAskPrice - 1;
        expect(await tpi.crossesBook(bid, bidPriceCrossing)).to.equal(true);
        expect(await tpi.crossesBook(bid, bidPriceCrossing2)).to.equal(true);
        expect(await tpi.crossesBook(bid, bidPriceNotCrossing)).to.equal(false);
      })
      
      it ("Should behave accordingly when multiple ask prices are added in descending order (offset by basePriceScaled)", async function() {
        const mappedAskPriceHi = Number(basePriceScaled) + 1000
        const mappedAskPriceLo = Number(basePriceScaled) + 999
        await tpi.addPrice(mappedAskPriceHi, ask)
        await tpi.addPrice(mappedAskPriceLo, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(mappedAskPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPriceLo)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        
        // Ask prices should not cross the book no matter what (there is no bid price yet)
        const askPriceLowest = mappedAskPriceLo - 1;
        const askPriceHighest = mappedAskPriceHi + 1;
        expect(await tpi.crossesBook(ask, askPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceHighest)).to.equal(false);

        // Crossing bid prices should cross, non-crossing should not:
        const bidPriceCrossing = mappedAskPriceLo + 1;
        const bidPriceCrossing2 = mappedAskPriceLo;
        const bidPriceNotCrossing = mappedAskPriceLo - 1;
        expect(await tpi.crossesBook(bid, bidPriceCrossing)).to.equal(true);
        expect(await tpi.crossesBook(bid, bidPriceCrossing2)).to.equal(true);
        expect(await tpi.crossesBook(bid, bidPriceNotCrossing)).to.equal(false);
      })

      it ("Should behave accordingly when multiple ask prices are added in ascending order (offset by basePriceScaled)", async function() {
        const mappedAskPriceLo = Number(basePriceScaled) + 999
        const mappedAskPriceHi = Number(basePriceScaled) + 1000
        await tpi.addPrice(mappedAskPriceLo, ask)
        await tpi.addPrice(mappedAskPriceHi, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(mappedAskPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPriceLo)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
      })

      it ("Should behave accordingly when an ask price is added then removed (offset by basePriceScaled)", async function() {
        const mappedAskPrice = Number(basePriceScaled) +  1000
        await tpi.addPrice(mappedAskPrice, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        
        await tpi.removePrice(mappedAskPrice, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        
        // Ask prices should not cross the book no matter what (there is bid no price yet)
        const askPriceLowest = mappedAskPrice - 1;
        const askPriceHighest = mappedAskPrice + 1;
        expect(await tpi.crossesBook(ask, askPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceHighest)).to.equal(false);

        // Bid prices should not cross as the book / index is empty: 
        const bidPriceCrossing = mappedAskPrice + 1;
        const bidPriceCrossing2 = mappedAskPrice;
        const bidPriceNotCrossing = mappedAskPrice - 1;
        expect(await tpi.crossesBook(bid, bidPriceCrossing)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPriceCrossing2)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPriceNotCrossing)).to.equal(false);
      })
      
      it ("Should behave accordingly when a sequenct of ask prices is added then removed (offset by basePriceScaled)", async function() {
        let mappedAskPrice1000 = Number(basePriceScaled) + 1000
        await tpi.addPrice(mappedAskPrice1000, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice1000)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice1000)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        
        
        let mappedAskPrice1001 = Number(basePriceScaled) + 1001
        await tpi.addPrice(mappedAskPrice1001, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice1001)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice1000)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)


        let mappedAskPrice1002 = Number(basePriceScaled) + 1002
        await tpi.addPrice(mappedAskPrice1002, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice1002)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice1000)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        

        await tpi.removePrice(mappedAskPrice1001, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice1002)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice1000)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        

        await tpi.removePrice(mappedAskPrice1000, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice1002)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice1002)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        

        await tpi.removePrice(mappedAskPrice1002, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
      })

      it ("Should behave accordingly when an ask of 0 is added and removed (offset by basePriceScaled)", async function() {
        const mappedAskPrice0 = Number(basePriceScaled) + 0
        await tpi.addPrice(mappedAskPrice0, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice0)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice0)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        

        const mappedAskPrice1 = Number(basePriceScaled) + 1
        await tpi.addPrice(mappedAskPrice1, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice1)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice0)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        

        await tpi.removePrice(mappedAskPrice1, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(mappedAskPrice0)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPrice0)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
        

        await tpi.removePrice(mappedAskPrice0, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
      })
      
      // TODO: Going to be problems to test when remove all bids, but not all asks!
      //       - Test for this
      
      it ("Should set bid min/max NULL when all bid prices removed in presence of ask prices (offset by basePriceScaled)", async function() {
        const mappedAskPriceHi = Number(basePriceScaled) + 1005
        const mappedAskPriceMd = Number(basePriceScaled) + 1003
        const mappedAskPriceLo = Number(basePriceScaled) + 1001
        const mappedBidPriceHi = Number(basePriceScaled) + 999
        const mappedBidPriceMd = Number(basePriceScaled) + 997
        const mappedBidPriceLo = Number(basePriceScaled) + 995

        await Promise.all([
          await tpi.addPrice(mappedAskPriceHi, ask),
          await tpi.addPrice(mappedAskPriceMd, ask),
          await tpi.addPrice(mappedAskPriceLo, ask),
          await tpi.addPrice(mappedBidPriceHi, bid),
          await tpi.addPrice(mappedBidPriceMd, bid),
          await tpi.addPrice(mappedBidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(mappedAskPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPriceLo)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPriceLo)


        // Now remove all bid prices and check for UNDEF_PRICE on bid min/max:
        //
        await Promise.all([
          await tpi.removePrice(mappedBidPriceHi, bid),
          await tpi.removePrice(mappedBidPriceMd, bid),
          await tpi.removePrice(mappedBidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(mappedAskPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPriceLo)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
      })

      it ("Should set ask min/max NULL when all ask prices removed in presence of bid prices (offset by basePriceScaled)", async function() {
        const mappedAskPriceHi = Number(basePriceScaled) + 1005
        const mappedAskPriceMd = Number(basePriceScaled) + 1003
        const mappedAskPriceLo = Number(basePriceScaled) + 1001
        const mappedBidPriceHi = Number(basePriceScaled) + 999
        const mappedBidPriceMd = Number(basePriceScaled) + 997
        const mappedBidPriceLo = Number(basePriceScaled) + 995

        await Promise.all([
          await tpi.addPrice(mappedAskPriceHi, ask),
          await tpi.addPrice(mappedAskPriceMd, ask),
          await tpi.addPrice(mappedAskPriceLo, ask),
          await tpi.addPrice(mappedBidPriceHi, bid),
          await tpi.addPrice(mappedBidPriceMd, bid),
          await tpi.addPrice(mappedBidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(mappedAskPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPriceLo)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPriceLo)


        // Now remove all ask prices and check for UNDEF_PRICE on ask min/max:
        //
        await Promise.all([
          await tpi.removePrice(mappedAskPriceHi, ask),
          await tpi.removePrice(mappedAskPriceMd, ask),
          await tpi.removePrice(mappedAskPriceLo, ask),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPriceLo)
      })
      
      it ("Should set all min/max NULL when all prices removed (offset by basePriceScaled)", async function() {
        const mappedAskPriceHi = Number(basePriceScaled) + 1005
        const mappedAskPriceMd = Number(basePriceScaled) + 1003
        const mappedAskPriceLo = Number(basePriceScaled) + 1001
        const mappedBidPriceHi = Number(basePriceScaled) + 999
        const mappedBidPriceMd = Number(basePriceScaled) + 997
        const mappedBidPriceLo = Number(basePriceScaled) + 995

        await Promise.all([
          await tpi.addPrice(mappedAskPriceHi, ask),
          await tpi.addPrice(mappedAskPriceMd, ask),
          await tpi.addPrice(mappedAskPriceLo, ask),
          await tpi.addPrice(mappedBidPriceHi, bid),
          await tpi.addPrice(mappedBidPriceMd, bid),
          await tpi.addPrice(mappedBidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(mappedAskPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(mappedAskPriceLo)
        expect(await tpi.getHighestBid()).to.equal(mappedBidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(mappedBidPriceLo)


        // Now remove all ask prices and check for UNDEF_PRICE on ask min/max:
        //
        await Promise.all([
          await tpi.removePrice(mappedAskPriceHi, ask),
          await tpi.removePrice(mappedAskPriceMd, ask),
          await tpi.removePrice(mappedAskPriceLo, ask),
          await tpi.removePrice(mappedBidPriceHi, bid),
          await tpi.removePrice(mappedBidPriceMd, bid),
          await tpi.removePrice(mappedBidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(UNDEF_PRICE)
        expect(await tpi.getHighestBid()).to.equal(UNDEF_PRICE)
        expect(await tpi.getLowestBid()).to.equal(UNDEF_PRICE)
      })
    })
  })
})

