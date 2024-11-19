require("dotenv").config();

import { ethers, waffle, network } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ContractReceipt, ContractTransaction, Signer } from "ethers";

import { expect } from "chai"
import { Test } from "mocha";

import { BigNumber } from "@ethersproject/bignumber";

import { TestPriceIndex, TestPriceIndex__factory } from "typechain-types";

import { createSnapshot, restoreSnapshot } from "./helpers/snapshots"

import { getBlockNumber, mineBlocks, JSONBI } from "./../scripts/utils/misc";
import { TransactionStats } from "./../scripts/utils/transactionStats";


const ds = require("./../scripts/utils/debugScopes");
const log = ds.getLog("priceIndex.tests");

const deployContracts = async (): Promise<{ tpi: TestPriceIndex,
                                            owner: SignerWithAddress,
                                            addrs: SignerWithAddress[] }> =>
{
  const [owner, ...addrs] = await ethers.getSigners()
  const tpi: TestPriceIndex = await new TestPriceIndex__factory(owner).deploy(0, 0);
  await mineBlocks()
  return { tpi, owner, addrs }
}

describe("Price Index Tree Test Suite", function() {
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

  describe("BitBucketLib Tests", function() {
    const ERROR_BIT_INDEX = BigNumber.from(15);

    describe("getSmallestNonZeroBitIndex Function Tests", function() {
      it ("Should return error index for empty bit-bucket", async function() {
        const bitBucket: bigint = 0n
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })

      it ("Should return index 0 for bit-bucket [0 ... 0 1]", async function() {
        const bitBucket: bigint = 2n**0n
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(0);
      })
      
      it ("Should return index 1 for bit-bucket [0 ... 0 1 0]", async function() {
        const bitBucket: bigint = 2n**1n
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(1);
      })
      
      it ("Should return index 13 for bit-bucket [0 1 0 ... 0]", async function() {
        const bitBucket: bigint = 2n**13n
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(13);
      })
      
      it ("Should return index 14 for bit-bucket [1 0 ... 0]", async function() {
        const bitBucket: bigint = 2n**14n
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(14);
      })
      
      it ("Should return error index for bit-bucket with only non-zero bits beyond index 14", async function() {
        const bitBucket: bigint = 2n**15n
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return index 0 for bit-bucket [0 ... 0 1 1]", async function() {
        const bitBucket: bigint = (2n**1n) + (2n**0n)
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(0);
      })

      it ("Should return index 13 for bit-bucket [1 1 0 ... 0]", async function() {
        const bitBucket: bigint = (2n**14n) + (2n**13n)
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(13);
      })
      
      it ("Should return index 0 for bit-bucket [1 ... 1]", async function() {
        const bitBucket: bigint = (2n**15n) - 1n
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(0);
      })
      
      it ("Should return index 1 for bit-bucket [1 ... 1 0]", async function() {
        const bitBucket: bigint = (2n**15n) - 2n
        const result = await tpi.getSmallestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(1);
      })
    })

    describe("getLargestNonZeroBitIndex Function Tests", function() {
      it ("Should return error index for empty bit-bucket", async function() {
        const bitBucket: bigint = 0n
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })

      it ("Should return index 0 for bit-bucket [0 ... 0 1]", async function() {
        const bitBucket: bigint = 2n**0n
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(0);
      })
      
      it ("Should return index 1 for bit-bucket [0 ... 0 1 0]", async function() {
        const bitBucket: bigint = 2n**1n
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(1);
      })
      
      it ("Should return index 13 for bit-bucket [0 1 0 ... 0]", async function() {
        const bitBucket: bigint = 2n**13n
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(13);
      })
      
      it ("Should return index 14 for bit-bucket [1 0 ... 0]", async function() {
        const bitBucket: bigint = 2n**14n
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(14);
      })
      
      it ("Should return error index for bit-bucket with only non-zero bits beyond index 14", async function() {
        const bitBucket: bigint = 2n**15n
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return index 1 for bit-bucket [0 ... 0 1 1]", async function() {
        const bitBucket: bigint = (2n**1n) + (2n**0n)
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(1);
      })

      it ("Should return index 14 for bit-bucket [1 1 0 ... 0]", async function() {
        const bitBucket: bigint = (2n**14n) + (2n**13n)
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(14);
      })
      
      it ("Should return index 14 for bit-bucket [1 ... 1]", async function() {
        const bitBucket: bigint = (2n**15n) - 1n
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(14);
      })
      
      it ("Should return index 13 for bit-bucket [ 0 1 ... 1]", async function() {
        const bitBucket: bigint = (2n**14n) - 1n
        const result = await tpi.getLargestNonZeroBitIndex(bitBucket)
        expect(result).to.equal(13);
      })
    })

    describe("getNearestNonZeroBitIndexBelowIndex Function Tests", function() {
      it ("Should return error index for empty bit-bucket", async function() {
        const bitBucket: bigint = 0n
        const index: bigint = 14n
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return error index for bit-bucket with only non-zero bits beyond index 14", async function() {
        const bitBucket: bigint = 2n**15n
        const index: bigint = 14n
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return error index for bit-bucket [ 0 ... 0 1 1 ] where index is 0", async function() {
        const bitBucket: bigint = (2n**1n) + (2n**0n)
        const index: bigint = 0n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return 0 for bit-bucket [ 0 ... 0 1 1 ] where index is 1", async function() {
        const bitBucket: bigint = (2n**1n) + (2n**0n)
        const index: bigint = 1n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(0);
      })
      
      it ("Should return 1 for bit-bucket [ 0 ... 0 1 1 ] where index is 2", async function() {
        const bitBucket: bigint = (2n**1n) + (2n**0n)
        const index: bigint = 2n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(1);
      })
      
      it ("Should return 1 for bit-bucket [ 0 ... 0 1 1 ] where index is 14", async function() {
        const bitBucket: bigint = (2n**1n) + (2n**0n)
        const index: bigint = 14n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(1);
      })
      
      it ("Should return error index for bit-bucket [ 1 0 ... 0 ] where index is 14", async function() {
        const bitBucket: bigint = (2n**14n)
        const index: bigint = 14n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return error index for bit-bucket [ 1 1 0 ... 0 ] where index is 13", async function() {
        const bitBucket: bigint = (2n**14n) + (2n**13n)
        const index: bigint = 13n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })

      it ("Should return 13 for bit-bucket [ 1 1 0 ... 0 ] where index is 14", async function() {
        const bitBucket: bigint = (2n**14n) + (2n**13n)
        const index: bigint = 14n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(13);
      })
      
      it ("Should return 7 for bit-bucket [ 1 ... 1 ] where index is 8", async function() {
        const bitBucket: bigint = (2n**15n) - 1n
        const index: bigint = 8n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(7);
      })
      
      it ("Should return 5 for bit-bucket [ 1 1 1  1 1 1 1  0 0 1 1  1 1 1 1 ] where index is 8", async function() {
        const bitBucket: bigint = ((2n**15n) - 1n) - (2n**7n) - (2n**6n)
        const index: bigint = 8n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(5);
      })
      
      it ("Should return 5 for bit-bucket [ 1 1 1  1 1 1 1  0 0 1 1  1 1 1 1 ] where index is 7", async function() {
        const bitBucket: bigint = ((2n**15n) - 1n) - (2n**7n) - (2n**6n)
        const index: bigint = 7n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(5);
      })
      
      it ("Should return 8 for bit-bucket [ 1 1 1  1 1 1 1  0 0 1 1  1 1 1 1 ] where index is 9", async function() {
        const bitBucket: bigint = ((2n**15n) - 1n) - (2n**7n) - (2n**6n)
        const index: bigint = 9n 
        const result = await tpi.getNearestNonZeroBitIndexBelowIndex(bitBucket, index)
        expect(result).to.equal(8);
      })
    })

    describe("getNearestNonZeroBitIndexAboveIndex Function Tests", function() {
      it ("Should return error index for empty bit-bucket", async function() {
        const bitBucket: bigint = 0n
        const index: bigint = 14n
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return error index for bit-bucket with only non-zero bits beyond index 14", async function() {
        const bitBucket: bigint = 2n**15n
        const index: bigint = 14n
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return error index for bit-bucket [ 1 1 0 ... 0 ] where index is 14", async function() {
        const bitBucket: bigint = (2n**14n) + (2n**13n)
        const index: bigint = 14n 
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return 14 for bit-bucket [ 1 1 0 ... 0 ] where index is 13", async function() {
        const bitBucket: bigint = (2n**14n) + (2n**13n)
        const index: bigint = 13n 
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(14);
      })
      
      it ("Should return 13 for bit-bucket [ 1 1 0 ... 0 ] where index is 12", async function() {
        const bitBucket: bigint = (2n**14n) + (2n**13n)
        const index: bigint = 12n 
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(13);
      })
      
      it ("Should return 13 for bit-bucket [ 1 1 0 ... 0 ] where index is 0", async function() {
        const bitBucket: bigint = (2n**14n) + (2n**13n)
        const index: bigint = 0n
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(13);
      })
      
      it ("Should return error index for bit-bucket [ 0 ... 0 1 ] where index is 0", async function() {
        const bitBucket: bigint = (2n**0n)
        const index: bigint = 0n
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return error index for bit-bucket [ 0 ... 0 1 1 ] where index is 1", async function() {
        const bitBucket: bigint = (2n**1n) + (2n**0n)
        const index: bigint = 1n 
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(ERROR_BIT_INDEX);
      })
      
      it ("Should return 1 for bit-bucket [ 0 ... 0 1 1 ] where index is 0", async function() {
        const bitBucket: bigint = (2n**1n) + (2n**0n)
        const index: bigint = 0n 
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(1);
      })

      it ("Should return 7 for bit-bucket [ 1 ... 1 ] where index is 6", async function() {
        const bitBucket: bigint = (2n**15n) - 1n
        const index: bigint = 6n 
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(7);
      })
      
      it ("Should return 8 for bit-bucket [ 1 1 1  1 1 1 1  0 0 1 1  1 1 1 1 ] where index is 5", async function() {
        const bitBucket: bigint = ((2n**15n) - 1n) - (2n**7n) - (2n**6n)
        const index: bigint = 5n 
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(8);
      })
      
      it ("Should return 8 for bit-bucket [ 1 1 1  1 1 1 1  0 0 1 1  1 1 1 1 ] where index is 6", async function() {
        const bitBucket: bigint = ((2n**15n) - 1n) - (2n**7n) - (2n**6n)
        const index: bigint = 6n 
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(8);
      })
      
      it ("Should return 5 for bit-bucket [ 1 1 1  1 1 1 1  0 0 1 1  1 1 1 1 ] where index is 4", async function() {
        const bitBucket: bigint = ((2n**15n) - 1n) - (2n**7n) - (2n**6n)
        const index: bigint = 4n 
        const result = await tpi.getNearestNonZeroBitIndexAboveIndex(bitBucket, index)
        expect(result).to.equal(5);
      })
    })
  })

  describe("Price Index Utilities Tests", function() {
    describe("decimalToBinaryCodedBase15 and binaryCodedBase15ToDecimal Tests", function() {
      it ("Should transform 0 to base15 correctly and back again.", async function() {
        const decimalNum = 0;
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum);
        let expected = ((2n**0n) << (5n*16n)) +
                       ((2n**0n) << (4n*16n)) +
                       ((2n**0n) << (3n*16n)) +
                       ((2n**0n) << (2n*16n)) +
                       ((2n**0n) << (1n*16n)) +
                       ((2n**0n) << (0n*16n));
        expect(bcb15Num).to.equal(expected);

        const decimalFromBcb15 = await tpi.binaryCodedBase15ToDecimal(bcb15Num)
        expect(decimalFromBcb15).to.equal(decimalNum)
      })

      it ("Should transform 1 to base15 correctly and back again.", async function() {
        const decimalNum = 1;
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum);
        let expected = ((2n**0n) << (5n*16n)) +
                       ((2n**0n) << (4n*16n)) +
                       ((2n**0n) << (3n*16n)) +
                       ((2n**0n) << (2n*16n)) +
                       ((2n**0n) << (1n*16n)) +
                       ((2n**1n) << (0n*16n));
        expect(bcb15Num).to.equal(expected);

        const decimalFromBcb15 = await tpi.binaryCodedBase15ToDecimal(bcb15Num)
        expect(decimalFromBcb15).to.equal(decimalNum)
      })
      
      it ("Should transform 11390624 to base15 correctly and back again.", async function() {
        const decimalNum = 11390624;  // base15 -> EEEEEE
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum);
        let expected = ((2n**14n) << (5n*16n)) +
                       ((2n**14n) << (4n*16n)) +
                       ((2n**14n) << (3n*16n)) +
                       ((2n**14n) << (2n*16n)) +
                       ((2n**14n) << (1n*16n)) +
                       ((2n**14n) << (0n*16n));
        expect(bcb15Num).to.equal(expected);

        const decimalFromBcb15 = await tpi.binaryCodedBase15ToDecimal(bcb15Num)
        expect(decimalFromBcb15).to.equal(decimalNum)
      })
      
      it ("Should transform 11390623 to base15 correctly and back again.", async function() {
        const decimalNum = 11390623;  // base15 -> EEEEED
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum);
        let expected = ((2n**14n) << (5n*16n)) +
                       ((2n**14n) << (4n*16n)) +
                       ((2n**14n) << (3n*16n)) +
                       ((2n**14n) << (2n*16n)) +
                       ((2n**14n) << (1n*16n)) +
                       ((2n**13n) << (0n*16n));
        expect(bcb15Num).to.equal(expected);

        const decimalFromBcb15 = await tpi.binaryCodedBase15ToDecimal(bcb15Num)
        expect(decimalFromBcb15).to.equal(decimalNum)
      })
      
      it ("Should transform 9912767 to base15 correctly and back again.", async function() {
        const decimalNum = 9912767;  // base15 -> D0C1B2
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum);
        let expected = ((2n**13n) << (5n*16n)) +
                       ((2n** 0n) << (4n*16n)) +
                       ((2n**12n) << (3n*16n)) +
                       ((2n** 1n) << (2n*16n)) +
                       ((2n**11n) << (1n*16n)) +
                       ((2n** 2n) << (0n*16n));
        expect(bcb15Num).to.equal(expected);

        const decimalFromBcb15 = await tpi.binaryCodedBase15ToDecimal(bcb15Num)
        expect(decimalFromBcb15).to.equal(decimalNum)
      })
      
      it ("Should transform 7777025 to base15 correctly and back again.", async function() {
        const decimalNum = 7777025;  // base15 -> A39485
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum);
        let expected = ((2n**10n) << (5n*16n)) +
                       ((2n** 3n) << (4n*16n)) +
                       ((2n** 9n) << (3n*16n)) +
                       ((2n** 4n) << (2n*16n)) +
                       ((2n** 8n) << (1n*16n)) +
                       ((2n** 5n) << (0n*16n));
        expect(bcb15Num).to.equal(expected);

        const decimalFromBcb15 = await tpi.binaryCodedBase15ToDecimal(bcb15Num)
        expect(decimalFromBcb15).to.equal(decimalNum)
      })
      
      it ("Should transform 5666642 to base15 correctly and back again.", async function() {
        const decimalNum = 5666642;  // base15 -> 76E012
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum);
        let expected = ((2n** 7n) << (5n*16n)) +
                       ((2n** 6n) << (4n*16n)) +
                       ((2n**14n) << (3n*16n)) +
                       ((2n** 0n) << (2n*16n)) +
                       ((2n** 1n) << (1n*16n)) +
                       ((2n** 2n) << (0n*16n));
        expect(bcb15Num).to.equal(expected);

        const decimalFromBcb15 = await tpi.binaryCodedBase15ToDecimal(bcb15Num)
        expect(decimalFromBcb15).to.equal(decimalNum)
      })
    })
    
    describe("Slot Index Getter Tests", function() {
      const BASE15 = 15

      describe("getMiddleIndex Tests", function() {
        it ("Should transform 00 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**0n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(0);
        })
        
        it ("Should transform 01 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**1n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(1);
        })
        
        it ("Should transform 12 correctly", async function() {
          let bcb15Value = ((2n**1n) << (5n*16n)) +
                           ((2n**2n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('12', BASE15));
        })
        
        it ("Should transform 34 correctly", async function() {
          let bcb15Value = ((2n**3n) << (5n*16n)) +
                           ((2n**4n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('34', BASE15));
        })
        
        it ("Should transform 56 correctly", async function() {
          let bcb15Value = ((2n**5n) << (5n*16n)) +
                           ((2n**6n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('56', BASE15));
        })
        
        it ("Should transform 78 correctly", async function() {
          let bcb15Value = ((2n**7n) << (5n*16n)) +
                           ((2n**8n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('78', BASE15));
        })
        
        it ("Should transform 9A correctly", async function() {
          let bcb15Value = ((2n** 9n) << (5n*16n)) +
                           ((2n**10n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('9A', BASE15));
        })
        
        it ("Should transform BC correctly", async function() {
          let bcb15Value = ((2n**11n) << (5n*16n)) +
                           ((2n**12n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('BC', BASE15));
        })
        
        it ("Should transform DE correctly", async function() {
          let bcb15Value = ((2n**13n) << (5n*16n)) +
                           ((2n**14n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('DE', BASE15));
        })
        
        it ("Should transform EE correctly", async function() {
          let bcb15Value = ((2n**14n) << (5n*16n)) +
                           ((2n**14n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('EE', BASE15));
        })
        
        it ("Should transform ED correctly", async function() {
          let bcb15Value = ((2n**14n) << (5n*16n)) +
                           ((2n**13n) << (4n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('ED', BASE15));
        })
      })
      
      describe("getBottomIndex Tests", function() {
        it ("Should transform 0000 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**0n) << (4n*16n)) +
                           ((2n**0n) << (3n*16n)) +
                           ((2n**0n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('0', BASE15));
        })

        it ("Should transform 0001 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**0n) << (4n*16n)) +
                           ((2n**0n) << (3n*16n)) +
                           ((2n**1n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('1', BASE15));
        })
        
        it ("Should transform 0020 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**0n) << (4n*16n)) +
                           ((2n**2n) << (3n*16n)) +
                           ((2n**0n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('20', BASE15));
        })

        it ("Should transform 0300 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**3n) << (4n*16n)) +
                           ((2n**0n) << (3n*16n)) +
                           ((2n**0n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('300', BASE15));
        })
        
        it ("Should transform 4000 correctly", async function() {
          let bcb15Value = ((2n**4n) << (5n*16n)) +
                           ((2n**0n) << (4n*16n)) +
                           ((2n**0n) << (3n*16n)) +
                           ((2n**0n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('4000', BASE15));
        })
        
        it ("Should transform EEEE correctly", async function() {
          let bcb15Value = ((2n**14n) << (5n*16n)) +
                           ((2n**14n) << (4n*16n)) +
                           ((2n**14n) << (3n*16n)) +
                           ((2n**14n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('EEEE', BASE15));
        })
        
        it ("Should transform EEED correctly", async function() {
          let bcb15Value = ((2n**14n) << (5n*16n)) +
                           ((2n**14n) << (4n*16n)) +
                           ((2n**14n) << (3n*16n)) +
                           ((2n**13n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('EEED', BASE15));
        })
        
        it ("Should transform 0034 correctly", async function() {
          let bcb15Value = ((2n** 0n) << (5n*16n)) +
                           ((2n** 0n) << (4n*16n)) +
                           ((2n** 3n) << (3n*16n)) +
                           ((2n** 4n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('34', BASE15));
        })

        it ("Should transform 1156 correctly", async function() {
          let bcb15Value = ((2n** 1n) << (5n*16n)) +
                           ((2n** 1n) << (4n*16n)) +
                           ((2n** 5n) << (3n*16n)) +
                           ((2n** 6n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('1156', BASE15));
        })

        it ("Should transform 2378 correctly", async function() {
          let bcb15Value = ((2n** 2n) << (5n*16n)) +
                           ((2n** 3n) << (4n*16n)) +
                           ((2n** 7n) << (3n*16n)) +
                           ((2n** 8n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('2378', BASE15));
        })

        it ("Should transform 459A correctly", async function() {
          let bcb15Value = ((2n** 4n) << (5n*16n)) +
                           ((2n** 5n) << (4n*16n)) +
                           ((2n** 9n) << (3n*16n)) +
                           ((2n**10n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('459A', BASE15));
        })
        
        it ("Should transform 67BC correctly", async function() {
          let bcb15Value = ((2n** 6n) << (5n*16n)) +
                           ((2n** 7n) << (4n*16n)) +
                           ((2n**11n) << (3n*16n)) +
                           ((2n**12n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('67BC', BASE15));
        })
        
        it ("Should transform 89DE correctly", async function() {
          let bcb15Value = ((2n** 8n) << (5n*16n)) +
                           ((2n** 9n) << (4n*16n)) +
                           ((2n**13n) << (3n*16n)) +
                           ((2n**14n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('89DE', BASE15));
        })
        
        it ("Should transform DD01 correctly", async function() {
          let bcb15Value = ((2n**13n) << (5n*16n)) +
                           ((2n**13n) << (4n*16n)) +
                           ((2n** 0n) << (3n*16n)) +
                           ((2n** 1n) << (2n*16n))
          const middleIndex = await tpi.getMiddleIndex(bcb15Value)
          const bottomIndex = await tpi.getBottomIndex(bcb15Value, middleIndex)
          expect(bottomIndex).to.equal(Number.parseInt('DD01', BASE15));
        })
      })
      
      describe("getSlotIndices Tests", function() {
        it ("Should transform 0000 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**0n) << (4n*16n)) +
                           ((2n**0n) << (3n*16n)) +
                           ((2n**0n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('0', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('0', BASE15));
        })

        it ("Should transform 0001 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**0n) << (4n*16n)) +
                           ((2n**0n) << (3n*16n)) +
                           ((2n**1n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('0', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('1', BASE15));
        })
        
        it ("Should transform 0020 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**0n) << (4n*16n)) +
                           ((2n**2n) << (3n*16n)) +
                           ((2n**0n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('0', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('20', BASE15));
        })

        it ("Should transform 0300 correctly", async function() {
          let bcb15Value = ((2n**0n) << (5n*16n)) +
                           ((2n**3n) << (4n*16n)) +
                           ((2n**0n) << (3n*16n)) +
                           ((2n**0n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('3', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('300', BASE15));
        })
        
        it ("Should transform 4000 correctly", async function() {
          let bcb15Value = ((2n**4n) << (5n*16n)) +
                           ((2n**0n) << (4n*16n)) +
                           ((2n**0n) << (3n*16n)) +
                           ((2n**0n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('40', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('4000', BASE15));
        })
        
        it ("Should transform EEEE correctly", async function() {
          let bcb15Value = ((2n**14n) << (5n*16n)) +
                           ((2n**14n) << (4n*16n)) +
                           ((2n**14n) << (3n*16n)) +
                           ((2n**14n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('EE', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('EEEE', BASE15));
        })
        
        it ("Should transform EEED correctly", async function() {
          let bcb15Value = ((2n**14n) << (5n*16n)) +
                           ((2n**14n) << (4n*16n)) +
                           ((2n**14n) << (3n*16n)) +
                           ((2n**13n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('EE', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('EEED', BASE15));
        })
        
        it ("Should transform 0034 correctly", async function() {
          let bcb15Value = ((2n** 0n) << (5n*16n)) +
                           ((2n** 0n) << (4n*16n)) +
                           ((2n** 3n) << (3n*16n)) +
                           ((2n** 4n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('0', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('34', BASE15));
        })

        it ("Should transform 1156 correctly", async function() {
          let bcb15Value = ((2n** 1n) << (5n*16n)) +
                           ((2n** 1n) << (4n*16n)) +
                           ((2n** 5n) << (3n*16n)) +
                           ((2n** 6n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('11', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('1156', BASE15));
        })

        it ("Should transform 2378 correctly", async function() {
          let bcb15Value = ((2n** 2n) << (5n*16n)) +
                           ((2n** 3n) << (4n*16n)) +
                           ((2n** 7n) << (3n*16n)) +
                           ((2n** 8n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('23', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('2378', BASE15));
        })

        it ("Should transform 459A correctly", async function() {
          let bcb15Value = ((2n** 4n) << (5n*16n)) +
                           ((2n** 5n) << (4n*16n)) +
                           ((2n** 9n) << (3n*16n)) +
                           ((2n**10n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('45', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('459A', BASE15));
        })
        
        it ("Should transform 67BC correctly", async function() {
          let bcb15Value = ((2n** 6n) << (5n*16n)) +
                           ((2n** 7n) << (4n*16n)) +
                           ((2n**11n) << (3n*16n)) +
                           ((2n**12n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('67', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('67BC', BASE15));
        })
        
        it ("Should transform 89DE correctly", async function() {
          let bcb15Value = ((2n** 8n) << (5n*16n)) +
                           ((2n** 9n) << (4n*16n)) +
                           ((2n**13n) << (3n*16n)) +
                           ((2n**14n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('89', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('89DE', BASE15));
        })
        
        it ("Should transform DD01 correctly", async function() {
          let bcb15Value = ((2n**13n) << (5n*16n)) +
                           ((2n**13n) << (4n*16n)) +
                           ((2n** 0n) << (3n*16n)) +
                           ((2n** 1n) << (2n*16n))
          const { middleIndex, bottomIndex } = await tpi.getSlotIndices(bcb15Value)
          expect(middleIndex).to.equal(Number.parseInt('DD', BASE15));
          expect(bottomIndex).to.equal(Number.parseInt('DD01', BASE15));
        })
      })
    })
  })

  describe("Price Index Feature Tests", function() {
    const BUCKET_WIDTH = 15n
    const CHILD_OFFSET = 1n * BUCKET_WIDTH



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
      it ("Should correctly add the price 0", async function() {
        const decimalNum = 0;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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

      it ("Should correctly add the price 1", async function() {
        const decimalNum = 1;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**0n +                                        // Root Level
                            ((2n**1n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add the price 7", async function() {
        const decimalNum = 7;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                        // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot =   2n**0n +                                        // Root Level
                            ((2n**7n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))    // Level 1 
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add the price 13", async function() {
        const decimalNum = 13;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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
      
      it ("Should correctly add the price 14", async function() {
        const decimalNum = 14;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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
      
      it ("Should correctly add prices 0 and 1", async function() {
        let decimalNum = 0;
        await tpi.addPrice(decimalNum, bid)
        decimalNum = 1;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        // Can do this b/c both prices in same slots:
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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
      
      it ("Should correctly add prices 0, 1, 7, 13 and 14", async function() {
        let decimalNum = 0
        let promises = []
        for (decimalNum of [0, 1, 7, 13, 14]) {
          promises.push(tpi.addPrice(decimalNum, bid))
        }
        await Promise.all(promises)
        await mineBlocks()

        // Can do this b/c all prices in same slots:
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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
      
      it ("Should correctly add the price 15", async function() {
        const decimalNum = 15;
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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
      
      it ("Should correctly add the price 210", async function() {
        const decimalNum = 210;   // 0000E0
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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
      
      it ("Should correctly add the prices 0, 195 and 210", async function() {
        let decimalNum = 0;   // 000000
        await tpi.addPrice(decimalNum, bid)
        decimalNum = 195;     // 0000D0
        await tpi.addPrice(decimalNum, bid)
        decimalNum = 210;     // 0000E0
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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
      
      it ("Should correctly add the prices 0, 15, 30, 45, 60 ..., 210", async function() {

        let promises = []
        let decimalNum = 0;
        promises.push(tpi.addPrice(decimalNum, bid))
        do {
          decimalNum += 15
          promises.push(tpi.addPrice(decimalNum, bid))
        } while (decimalNum < 210)

        await Promise.all(promises)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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

      it ("Should correctly add the prices 7, 22, 37, 52, 67 ..., 217", async function() {

        let promises = []
        let decimalNum = 7;
        promises.push(tpi.addPrice(decimalNum, bid))
        do {
          decimalNum += 15
          promises.push(tpi.addPrice(decimalNum, bid))
        } while (decimalNum < 217)

        await Promise.all(promises)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop =   2n**0n +                                         // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))     // Level 1 
        expect(top).to.equal(expectedTop)

        const expectedMid =   2n**0n +                                         // Root Level
                            ((2n**0n) << (CHILD_OFFSET + 0n*BUCKET_WIDTH))     // Level 1 
        expect(middle).to.equal(expectedMid)
        
        const expectedBot = ((2n**15n)-1n) +                                   // Root Level (every bit)
                            ((2n**7n) << (CHILD_OFFSET + 14n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET + 13n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET + 12n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET + 11n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET + 10n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET +  9n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET +  8n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET +  7n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET +  6n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET +  5n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET +  4n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET +  3n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET +  2n*BUCKET_WIDTH)) +  // Level 1, Bucket 2 
                            ((2n**7n) << (CHILD_OFFSET +  1n*BUCKET_WIDTH)) +  // Level 1, Bucket 1 
                            ((2n**7n) << (CHILD_OFFSET +  0n*BUCKET_WIDTH))    // Level 1, Bucket 0
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly add the price 11390624", async function() {
        const decimalNum = 11390624;  // 11390624 -> EEEEEE base15
        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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

      it ("Should correctly add the prices 11390410, 11390425, ... 11390620", async function() {

        let promises = []
        let decimalNum = 11390410n  // EEEE0A
        promises.push(tpi.addPrice(decimalNum, bid))
        do {
          decimalNum += 15n
          promises.push(tpi.addPrice(decimalNum, bid))
        } while (decimalNum < 11390620n)
        
        await Promise.all(promises)
        await mineBlocks()

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
      it ("Should correctly remove price 0", async function() {
        const decimalNum = 0;

        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        await tpi.removePrice(decimalNum, bid)
        await mineBlocks()

        
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)

        const expectedTop = 0n
        const expectedMid = 0n
        const expectedBot = 0n

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly remove ONLY price 0 then only price 8 after adding prices 0, 4, 8 & 12", async function() {

        let promises = []
        let decimalNum = 0
        promises.push(tpi.addPrice(decimalNum, bid))
        do {
          decimalNum += 4
          promises.push(tpi.addPrice(decimalNum, bid))
        } while (decimalNum < 12)
        
        await Promise.all(promises)
        await mineBlocks()


        await tpi.removePrice(0, bid)
        await mineBlocks()
        
        // Slots should match after removing price 0
        //
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
        

        await tpi.removePrice(8, bid)
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

      it ("Should correctly remove ONLY price 20, then price 95, then 215, after adding prices 5, 20, 35 ... 215", async function() {

        let promises = []
        let decimalNum = 5
        promises.push(tpi.addPrice(decimalNum, bid))
        do {
          decimalNum += 15
          promises.push(tpi.addPrice(decimalNum, bid))
        } while (decimalNum < 215)
        
        await Promise.all(promises)
        await mineBlocks()


        await tpi.removePrice(20, bid)
        await mineBlocks()
        
        // Slots should match after removing price 20
        //
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
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
        

        await tpi.removePrice(95, bid)
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


        await tpi.removePrice(215, bid)
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

      it ("Should correctly remove price 11390620", async function() {
        const decimalNum = 11390620;  // EEEEEE base15

        await tpi.addPrice(decimalNum, bid)
        await mineBlocks()

        await tpi.removePrice(decimalNum, bid)
        await mineBlocks()

        
        const bcb15Num = await tpi.decimalToBinaryCodedBase15(decimalNum)
        const { top, middle, bottom } = await tpi.getPriceSlots(bcb15Num)
        
        const expectedTop = 0n
        const expectedMid = 0n
        const expectedBot = 0n

        expect(top).to.equal(expectedTop)
        expect(middle).to.equal(expectedMid)
        expect(bottom).to.equal(expectedBot)
      })
      
      it ("Should correctly remove only prices 11390474 & 11390549 after adding 11390414, 11390429, ... 11390624", async function() {
        
        let promises = []
        let decimalNum = 11390414   // EEEE0E base15
        promises.push(tpi.addPrice(decimalNum, bid))
        do {
          decimalNum += 15
          promises.push(tpi.addPrice(decimalNum, bid))
        } while (decimalNum < 11390624 /* EEEEEE base15 */ )
        
        await Promise.all(promises)
        await mineBlocks()

        await tpi.removePrice(11390474, bid)
        await tpi.removePrice(11390549, bid)
        await mineBlocks()

        
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
      const NULL_PRICE = (2**32 - 2)
      const ABOVE = true
      const BELOW = !ABOVE
      const MAX_PRICE = Number.parseInt("EEEEEE", 15)

      it ("Should return undef price when the price tree is empty", async function() {
        let nearestPrice = await tpi.getNearestPriceExternal(0, ABOVE)
        expect(nearestPrice).to.equal(NULL_PRICE)
        
        nearestPrice = await tpi.getNearestPriceExternal(0, BELOW)
        expect(nearestPrice).to.equal(NULL_PRICE)
        
        nearestPrice = await tpi.getNearestPriceExternal(1, ABOVE)
        expect(nearestPrice).to.equal(NULL_PRICE)
        
        nearestPrice = await tpi.getNearestPriceExternal(1, BELOW)
        expect(nearestPrice).to.equal(NULL_PRICE)
      })
      
      it ("Should return undef price searching and no price in above direction", async function() {
        await tpi.addPrice(0, bid)
        await mineBlocks()
        
        let nearestPrice = await tpi.getNearestPriceExternal(1, ABOVE)
        expect(nearestPrice).to.equal(NULL_PRICE)
      })
      
      it ("Should return undef price searching and no price in below direction", async function() {
        await tpi.addPrice(MAX_PRICE, bid)
        await mineBlocks()
        
        let nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE - 1, BELOW)
        expect(nearestPrice).to.equal(NULL_PRICE)
      })

      it ("Should return price if searching that price in either search direction", async function() {
        const price = Math.floor(MAX_PRICE / 2)
        await tpi.addPrice(price, bid)
        await mineBlocks()
        
        let nearestPrice = await tpi.getNearestPriceExternal(price, BELOW)
        expect(nearestPrice).to.equal(price)
        
        nearestPrice = await tpi.getNearestPriceExternal(price, ABOVE)
        expect(nearestPrice).to.equal(price)

        // Add more prices near and try again:
        //
        await Promise.all([tpi.addPrice(price-2, bid),
                           tpi.addPrice(price-1, bid),
                           tpi.addPrice(price+1, bid),
                           tpi.addPrice(price+2, bid)])
        await mineBlocks()
        
        nearestPrice = await tpi.getNearestPriceExternal(price, BELOW)
        expect(nearestPrice).to.equal(price)
        
        nearestPrice = await tpi.getNearestPriceExternal(price, ABOVE)
        expect(nearestPrice).to.equal(price)
      })

      it ("Should return 0 if only price for prices above or 0 and search direction below", async function() {
        await tpi.addPrice(0, bid)
        await mineBlocks()

        let nearestPrice = await tpi.getNearestPriceExternal(0, BELOW)
        expect(nearestPrice).to.equal(0)

        nearestPrice = await tpi.getNearestPriceExternal(1, BELOW)
        expect(nearestPrice).to.equal(0)
        
        nearestPrice = await tpi.getNearestPriceExternal(2, BELOW)
        expect(nearestPrice).to.equal(0)
        
        nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE-1, BELOW)
        expect(nearestPrice).to.equal(0)
        
        nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE, BELOW)
        expect(nearestPrice).to.equal(0)
      })
      
      it ("Should return 1 if only prices 0 & 1 for prices above 0 and search direction below", async function() {
        await tpi.addPrice(0, bid)
        await tpi.addPrice(1, bid)
        await mineBlocks()

        let nearestPrice = await tpi.getNearestPriceExternal(1, BELOW)
        expect(nearestPrice).to.equal(1)

        nearestPrice = await tpi.getNearestPriceExternal(2, BELOW)
        expect(nearestPrice).to.equal(1)
        
        nearestPrice = await tpi.getNearestPriceExternal(Math.floor(MAX_PRICE / 2), BELOW)
        expect(nearestPrice).to.equal(1)
        
        nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE-1, BELOW)
        expect(nearestPrice).to.equal(1)
        
        nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE, BELOW)
        expect(nearestPrice).to.equal(1)
      })
      
      it ("Should return MAX_PRICE if only price for prices below or MAX_PRICE and search direction above", async function() {
        await tpi.addPrice(MAX_PRICE, bid)
        await mineBlocks()

        let nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE, ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE)

        nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE-1, ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE)
        
        nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE-2, ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE)
        
        nearestPrice = await tpi.getNearestPriceExternal(0+1, ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE)
        
        nearestPrice = await tpi.getNearestPriceExternal(0, ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE)
      })
      
      it ("Should return MAX_PRICE-1 if only prices MAX_PRICE & MAX_PRICE-1 for prices below MAX_PRICE and search direction above", async function() {
        await tpi.addPrice(MAX_PRICE-1, bid)
        await tpi.addPrice(MAX_PRICE, bid)
        await mineBlocks()

        let nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE-1, ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE-1)

        nearestPrice = await tpi.getNearestPriceExternal(MAX_PRICE-2, ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE-1)
        
        nearestPrice = await tpi.getNearestPriceExternal(Math.floor(MAX_PRICE / 2), ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE-1)
        
        nearestPrice = await tpi.getNearestPriceExternal(1, ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE-1)
        
        nearestPrice = await tpi.getNearestPriceExternal(0, ABOVE)
        expect(nearestPrice).to.equal(MAX_PRICE-1)
      })
    })
    
    describe("Crosses Book, Update Min/Max, Get Highest Bid and Get Lowest Ask Tests", function() {
      const NULL_PRICE = (2**32 - 2)
      const ABOVE = true
      const BELOW = !ABOVE
      const MAX_PRICE = Number.parseInt("EEEEEE", 15)

      it ("Should behave correctly when the index is empty", async function() {
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)

        let isBid = true;
        expect(await tpi.crossesBook(isBid, 0)).to.equal(false)
        expect(await tpi.crossesBook(isBid, MAX_PRICE)).to.equal(false)

        isBid = false;
        expect(await tpi.crossesBook(isBid, 0)).to.equal(false)
        expect(await tpi.crossesBook(isBid, MAX_PRICE)).to.equal(false)
      })


      it ("Should behave accordingly when a bid price is added", async function() {
        const bidPrice = 1000
        await tpi.addPrice(bidPrice, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice)
        expect(await tpi.getLowestBid()).to.equal(bidPrice)

        // Bid prices should not cross the book no matter what (there is no ask price yet)
        const bidPriceLo = bidPrice - 1;
        const bidPriceHi = bidPrice + 1;
        expect(await tpi.crossesBook(bid, bidPriceLo)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPrice)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPriceHi)).to.equal(false);

        // Crossing ask prices should cross, non-crossing should not:
        const askPriceCrossing = bidPrice - 1;
        const askPriceCrossing2 = bidPrice;
        const askPriceNotCrossing = bidPrice +1;
        expect(await tpi.crossesBook(ask, askPriceCrossing)).to.equal(true);
        expect(await tpi.crossesBook(ask, askPriceCrossing2)).to.equal(true);
        expect(await tpi.crossesBook(ask, askPriceNotCrossing)).to.equal(false);
      })
      
      it ("Should behave accordingly when multiple bid prices are added in descending order", async function() {
        const bidPriceHi = 1000
        const bidPriceLo = 999
        await tpi.addPrice(bidPriceHi, bid)
        await tpi.addPrice(bidPriceLo, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(bidPriceLo)
        
        // Bid prices should not cross the book no matter what (there is no ask price yet)
        const bidPriceLowest = bidPriceLo - 1;
        const bidPriceHighest = bidPriceHi + 1;
        expect(await tpi.crossesBook(bid, bidPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPriceHighest)).to.equal(false);

        // Crossing ask prices should cross, non-crossing should not:
        const askPriceCrossing = bidPriceHi - 1;
        const askPriceCrossing2 = bidPriceHi;
        const askPriceNotCrossing = bidPriceHi + 1;
        expect(await tpi.crossesBook(ask, askPriceCrossing)).to.equal(true);
        expect(await tpi.crossesBook(ask, askPriceCrossing2)).to.equal(true);
        expect(await tpi.crossesBook(ask, askPriceNotCrossing)).to.equal(false);
      })

      it ("Should behave accordingly when multiple bid prices are added in ascending order", async function() {
        const bidPriceLo = 999
        const bidPriceHi = 1000
        await tpi.addPrice(bidPriceLo, bid)
        await tpi.addPrice(bidPriceHi, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(bidPriceLo)
      })

      it ("Should behave accordingly when a bid price is added then removed", async function() {
        const bidPrice = 1000
        await tpi.addPrice(bidPrice, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice)
        expect(await tpi.getLowestBid()).to.equal(bidPrice)
        
        await tpi.removePrice(bidPrice, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        
        // Bid prices should not cross the book no matter what (there is no ask price yet)
        const bidPriceLowest = bidPrice - 1;
        const bidPriceHighest = bidPrice + 1;
        expect(await tpi.crossesBook(bid, bidPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPriceHighest)).to.equal(false);

        // Crossing ask prices should not cross the book when empty:
        const askPriceNotCrossing = bidPrice - 1;
        const askPriceNotCrossing2 = bidPrice;
        const askPriceNotCrossing3 = bidPrice + 1;
        expect(await tpi.crossesBook(ask, askPriceNotCrossing)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceNotCrossing2)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceNotCrossing3)).to.equal(false);
      })
      
      it ("Should behave accordingly when a sequence of bid prices is added then removed", async function() {
        let bidPrice1000 = 1000
        await tpi.addPrice(bidPrice1000, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice1000)
        expect(await tpi.getLowestBid()).to.equal(bidPrice1000)
        
        
        let bidPrice1001 = 1001
        await tpi.addPrice(bidPrice1001, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice1001)
        expect(await tpi.getLowestBid()).to.equal(bidPrice1000)


        let bidPrice1002 = 1002
        await tpi.addPrice(bidPrice1002, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice1002)
        expect(await tpi.getLowestBid()).to.equal(bidPrice1000)
        

        await tpi.removePrice(bidPrice1001, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice1002)
        expect(await tpi.getLowestBid()).to.equal(bidPrice1000)
        

        await tpi.removePrice(bidPrice1000, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice1002)
        expect(await tpi.getLowestBid()).to.equal(bidPrice1002)
        

        await tpi.removePrice(bidPrice1002, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
      })

      it ("Should behave accordingly when a bid of 0 is added and removed", async function() {
        const bidPrice0 = 0
        await tpi.addPrice(bidPrice0, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice0)
        expect(await tpi.getLowestBid()).to.equal(bidPrice0)
        

        const bidPrice1 = 1
        await tpi.addPrice(bidPrice1, bid)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice1)
        expect(await tpi.getLowestBid()).to.equal(bidPrice0)
        

        await tpi.removePrice(bidPrice1, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPrice0)
        expect(await tpi.getLowestBid()).to.equal(bidPrice0)
        

        await tpi.removePrice(bidPrice0, bid)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
      })


      it ("Should behave accordingly when an ask price is added", async function() {
        const askPrice = 1000
        await tpi.addPrice(askPrice, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(askPrice)
        expect(await tpi.getLowestAsk()).to.equal(askPrice)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        
        // Ask prices should not cross the book no matter what (there is no bid price yet)
        const askPriceLowest = askPrice - 1;
        const askPriceHighest = askPrice + 1;
        expect(await tpi.crossesBook(ask, askPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceHighest)).to.equal(false);

        // Crossing bid prices should cross, non-crossing should not:
        const bidPriceCrossing = askPrice + 1;
        const bidPriceCrossing2 = askPrice;
        const bidPriceNotCrossing = askPrice - 1;
        expect(await tpi.crossesBook(bid, bidPriceCrossing)).to.equal(true);
        expect(await tpi.crossesBook(bid, bidPriceCrossing2)).to.equal(true);
        expect(await tpi.crossesBook(bid, bidPriceNotCrossing)).to.equal(false);
      })
      
      it ("Should behave accordingly when multiple ask prices are added in descending order", async function() {
        const askPriceHi = 1000
        const askPriceLo = 999
        await tpi.addPrice(askPriceHi, ask)
        await tpi.addPrice(askPriceLo, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(askPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(askPriceLo)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        
        // Ask prices should not cross the book no matter what (there is no bid price yet)
        const askPriceLowest = askPriceLo - 1;
        const askPriceHighest = askPriceHi + 1;
        expect(await tpi.crossesBook(ask, askPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceHighest)).to.equal(false);

        // Crossing bid prices should cross, non-crossing should not:
        const bidPriceCrossing = askPriceLo + 1;
        const bidPriceCrossing2 = askPriceLo;
        const bidPriceNotCrossing = askPriceLo - 1;
        expect(await tpi.crossesBook(bid, bidPriceCrossing)).to.equal(true);
        expect(await tpi.crossesBook(bid, bidPriceCrossing2)).to.equal(true);
        expect(await tpi.crossesBook(bid, bidPriceNotCrossing)).to.equal(false);
      })

      it ("Should behave accordingly when multiple ask prices are added in ascending order", async function() {
        const askPriceLo = 999
        const askPriceHi = 1000
        await tpi.addPrice(askPriceLo, ask)
        await tpi.addPrice(askPriceHi, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(askPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(askPriceLo)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
      })

      it ("Should behave accordingly when an ask price is added then removed", async function() {
        const askPrice = 1000
        await tpi.addPrice(askPrice, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(askPrice)
        expect(await tpi.getLowestAsk()).to.equal(askPrice)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        
        await tpi.removePrice(askPrice, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        
        // Ask prices should not cross the book no matter what (there is bid no price yet)
        const askPriceLowest = askPrice - 1;
        const askPriceHighest = askPrice + 1;
        expect(await tpi.crossesBook(ask, askPriceLowest)).to.equal(false);
        expect(await tpi.crossesBook(ask, askPriceHighest)).to.equal(false);

        // Bid prices should not cross as the book / index is empty: 
        const bidPriceCrossing = askPrice + 1;
        const bidPriceCrossing2 = askPrice;
        const bidPriceNotCrossing = askPrice - 1;
        expect(await tpi.crossesBook(bid, bidPriceCrossing)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPriceCrossing2)).to.equal(false);
        expect(await tpi.crossesBook(bid, bidPriceNotCrossing)).to.equal(false);
      })
      
      it ("Should behave accordingly when a sequenct of ask prices is added then removed", async function() {
        let askPrice1000 = 1000
        await tpi.addPrice(askPrice1000, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(askPrice1000)
        expect(await tpi.getLowestAsk()).to.equal(askPrice1000)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        
        
        let askPrice1001 = 1001
        await tpi.addPrice(askPrice1001, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(askPrice1001)
        expect(await tpi.getLowestAsk()).to.equal(askPrice1000)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)


        let askPrice1002 = 1002
        await tpi.addPrice(askPrice1002, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(askPrice1002)
        expect(await tpi.getLowestAsk()).to.equal(askPrice1000)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        

        await tpi.removePrice(askPrice1001, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(askPrice1002)
        expect(await tpi.getLowestAsk()).to.equal(askPrice1000)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        

        await tpi.removePrice(askPrice1000, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(askPrice1002)
        expect(await tpi.getLowestAsk()).to.equal(askPrice1002)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        

        await tpi.removePrice(askPrice1002, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
      })

      it ("Should behave accordingly when an ask of 0 is added and removed", async function() {
        const askPrice0 = 0
        await tpi.addPrice(askPrice0, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(askPrice0)
        expect(await tpi.getLowestAsk()).to.equal(askPrice0)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        

        const askPrice1 = 1
        await tpi.addPrice(askPrice1, ask)
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(askPrice1)
        expect(await tpi.getLowestAsk()).to.equal(askPrice0)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        

        await tpi.removePrice(askPrice1, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(askPrice0)
        expect(await tpi.getLowestAsk()).to.equal(askPrice0)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
        

        await tpi.removePrice(askPrice0, ask)
        await mineBlocks()
        
        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
      })
      


      
      it ("Should set bid min/max NULL when all bid prices removed in presence of ask prices", async function() {
        const askPriceHi = 1005
        const askPriceMd = 1003
        const askPriceLo = 1001
        const bidPriceHi = 999
        const bidPriceMd = 997
        const bidPriceLo = 995

        await Promise.all([
          await tpi.addPrice(askPriceHi, ask),
          await tpi.addPrice(askPriceMd, ask),
          await tpi.addPrice(askPriceLo, ask),
          await tpi.addPrice(bidPriceHi, bid),
          await tpi.addPrice(bidPriceMd, bid),
          await tpi.addPrice(bidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(askPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(askPriceLo)
        expect(await tpi.getHighestBid()).to.equal(bidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(bidPriceLo)


        // Now remove all bid prices and check for NULL_PRICE on bid min/max:
        //
        await Promise.all([
          await tpi.removePrice(bidPriceHi, bid),
          await tpi.removePrice(bidPriceMd, bid),
          await tpi.removePrice(bidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(askPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(askPriceLo)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
      })

      it ("Should set ask min/max NULL when all ask prices removed in presence of bid prices", async function() {
        const askPriceHi = 1005
        const askPriceMd = 1003
        const askPriceLo = 1001
        const bidPriceHi = 999
        const bidPriceMd = 997
        const bidPriceLo = 995

        await Promise.all([
          await tpi.addPrice(askPriceHi, ask),
          await tpi.addPrice(askPriceMd, ask),
          await tpi.addPrice(askPriceLo, ask),
          await tpi.addPrice(bidPriceHi, bid),
          await tpi.addPrice(bidPriceMd, bid),
          await tpi.addPrice(bidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(askPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(askPriceLo)
        expect(await tpi.getHighestBid()).to.equal(bidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(bidPriceLo)


        // Now remove all ask prices and check for NULL_PRICE on ask min/max:
        //
        await Promise.all([
          await tpi.removePrice(askPriceHi, ask),
          await tpi.removePrice(askPriceMd, ask),
          await tpi.removePrice(askPriceLo, ask),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(bidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(bidPriceLo)
      })
      
      it ("Should set all min/max NULL when all prices removed", async function() {
        const askPriceHi = 1005
        const askPriceMd = 1003
        const askPriceLo = 1001
        const bidPriceHi = 999
        const bidPriceMd = 997
        const bidPriceLo = 995

        await Promise.all([
          await tpi.addPrice(askPriceHi, ask),
          await tpi.addPrice(askPriceMd, ask),
          await tpi.addPrice(askPriceLo, ask),
          await tpi.addPrice(bidPriceHi, bid),
          await tpi.addPrice(bidPriceMd, bid),
          await tpi.addPrice(bidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(askPriceHi)
        expect(await tpi.getLowestAsk()).to.equal(askPriceLo)
        expect(await tpi.getHighestBid()).to.equal(bidPriceHi)
        expect(await tpi.getLowestBid()).to.equal(bidPriceLo)


        // Now remove all ask prices and check for NULL_PRICE on ask min/max:
        //
        await Promise.all([
          await tpi.removePrice(askPriceHi, ask),
          await tpi.removePrice(askPriceMd, ask),
          await tpi.removePrice(askPriceLo, ask),
          await tpi.removePrice(bidPriceHi, bid),
          await tpi.removePrice(bidPriceMd, bid),
          await tpi.removePrice(bidPriceLo, bid),
        ])
        await mineBlocks()

        expect(await tpi.getHighestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestAsk()).to.equal(NULL_PRICE)
        expect(await tpi.getHighestBid()).to.equal(NULL_PRICE)
        expect(await tpi.getLowestBid()).to.equal(NULL_PRICE)
      })

    })
  })
})
