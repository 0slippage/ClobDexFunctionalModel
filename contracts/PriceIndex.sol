// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;

import { PriceTypeFP, PriceLib } from "./Types.sol";

import "hardhat/console.sol";   

uint256 constant MAX_PRICE_INDEX = 15 ** 6;    

error AddedPriceCrossesBook(uint256 _indexedPrice, uint256 _indexedMinPrice, uint256 _indexedMaxPrice);
error ScaledPriceOutOfBounds(uint256 invalidPrice, uint256 minScaledPrice, uint256 maxScaledPrice);

struct PriceIndex {
  PriceTypeFP maxAskPrice;
  PriceTypeFP minAskPrice;
  PriceTypeFP maxBidPrice;
  PriceTypeFP minBidPrice;
  uint256 basePriceScaled;
  uint256 decimalScaling;
  uint256 top;                       
  mapping(uint8 => uint256) middle;  
  mapping(uint16 => uint256) bottom; 
}
  
uint256 constant B15_DIGITS = 6;
uint256 constant MASK_16_BITS = (2**16) - 1;
uint256 constant MASK_15_BITS = (2**15) - 1;

library PriceIndexLib {
  using PriceLib for PriceTypeFP;
  using BinaryCodingLib for uint256;
  using BitBucketLib for uint256;


  function init(PriceIndex storage _pi, uint256 _basePriceScaled, uint256 _decimalScaling) internal {
    _pi.maxAskPrice = PriceLib.UNDEF_PRICE;
    _pi.minAskPrice = PriceLib.UNDEF_PRICE;
    _pi.maxBidPrice = PriceLib.UNDEF_PRICE;
    _pi.minBidPrice = PriceLib.UNDEF_PRICE;

    _pi.basePriceScaled = _basePriceScaled;
    _pi.decimalScaling = _decimalScaling;
  }

  function addPrice(PriceIndex storage _pi, PriceTypeFP _priceScaled, bool _isBid) internal {
    PriceTypeFP _price = mapRealScaledToIndexedPrice(_pi, _priceScaled);

    updateMinMaxPrices(_pi, _price, _isBid, true);

    uint256 _priceBCB15 = (_price.toUint256()).decimalToBinaryCodedBase15();

    uint256 slotLevel = 0;
    uint256 rShiftBits = B15_DIGITS * 16;
    uint256 bcb15Digit;
    (uint8 middleIndex, uint16 bottomIndex) = _priceBCB15.getSlotIndices();

    do {
      slotLevel++;
      

      rShiftBits -= 16;
      bcb15Digit = (_priceBCB15 >> rShiftBits) & MASK_15_BITS;

      uint256 slot = (slotLevel == 1) ? _pi.top :
                     (slotLevel == 2) ? _pi.middle[middleIndex]:
                                        _pi.bottom[bottomIndex];
      slot = slot | bcb15Digit;

      uint256 bucketOffset = bcb15Digit.binaryCodedBase15ToBucketOffset();
      rShiftBits -= 16;
      bcb15Digit = (_priceBCB15 >> rShiftBits) & MASK_15_BITS;

      slot = slot | (bcb15Digit << bucketOffset);
      if (slotLevel == 1) {
        _pi.top = slot;
      } else if (slotLevel == 2) {
        _pi.middle[middleIndex] = slot;
      } else {
        _pi.bottom[bottomIndex] = slot;
      }
    } while (slotLevel < 3);
  }

  function removePrice(PriceIndex storage _pi, PriceTypeFP _priceScaled, bool _isBid) internal {
    PriceTypeFP _price = mapRealScaledToIndexedPrice(_pi, _priceScaled);

    uint256 _priceBCB15 = (_price.toUint256()).decimalToBinaryCodedBase15();

    bool updateNextSlotLevel;
    uint256 slotLevel = 3;
    uint256 rShiftBits = 0;
    (uint8 middleIndex, uint16 bottomIndex) = _priceBCB15.getSlotIndices();
    do {
      updateNextSlotLevel = false;

      uint256 slot = (slotLevel == 1) ? _pi.top :
                     (slotLevel == 2) ? _pi.middle[middleIndex]:
                                        _pi.bottom[bottomIndex];

      uint256 childBcb15Digit = (_priceBCB15 >> rShiftBits) & MASK_15_BITS;
      uint256 parentBcb15Digit = (_priceBCB15 >> (rShiftBits + 16)) & MASK_15_BITS;

      uint256 bucketOffset = parentBcb15Digit.binaryCodedBase15ToBucketOffset();
      slot = slot & (~(childBcb15Digit << bucketOffset));

      uint256 bitBucket = (slot >> bucketOffset) & MASK_15_BITS;
      if (bitBucket == 0) {

        slot = slot & (~parentBcb15Digit);

        bitBucket = slot & MASK_15_BITS;
        if (bitBucket == 0) {
          updateNextSlotLevel = true;

          rShiftBits += 2*16;
        }
      }

      if (slotLevel == 1) {
        _pi.top = slot;
      } else if (slotLevel == 2) {
        _pi.middle[middleIndex] = slot;
      } else {
        _pi.bottom[bottomIndex] = slot;
      }

      slotLevel--;
    } while (slotLevel >= 1 && updateNextSlotLevel);

    PriceTypeFP nearestPrice;

    if (_isBid) {
      if (_price.eq(_pi.maxBidPrice)) {
        nearestPrice = getNearestPriceInternal(_pi, _price, false /* above=false */);
        if (nearestPrice.isUndef()) {
          _pi.maxBidPrice = PriceLib.UNDEF_PRICE;
          _pi.minBidPrice = PriceLib.UNDEF_PRICE;
          return;
        }
        _pi.maxBidPrice = nearestPrice;
      }

      if (_price.eq(_pi.minBidPrice)) {
        if (nearestPrice.zero()) {
          nearestPrice = getNearestPriceInternal(_pi, _price, true /* above */);
        }
        _pi.minBidPrice = nearestPrice;
      }
    } else {
      if (_price.eq(_pi.minAskPrice)) {
        nearestPrice = getNearestPriceInternal(_pi, _price, true /* above */);
        if (nearestPrice.isUndef()) {
          _pi.maxAskPrice = PriceLib.UNDEF_PRICE;
          _pi.minAskPrice = PriceLib.UNDEF_PRICE;
          return;
        }
        _pi.minAskPrice = nearestPrice;
      }

      if (_price.eq(_pi.maxAskPrice)) {
        if (nearestPrice.zero()) {
          nearestPrice = getNearestPriceInternal(_pi, _price, false /* above */);
        }
        _pi.maxAskPrice= nearestPrice;
      }
    }
  }
  
  function crossesBook(PriceIndex storage _pi, bool _isBid, PriceTypeFP _priceScaled) internal view returns (bool crosses)
  {
    PriceTypeFP _price = mapRealScaledToIndexedPrice(_pi, _priceScaled);

    if (_isBid) {
      crosses = (!_pi.minAskPrice.isUndef() && _price.gte(_pi.minAskPrice));
    } else {
      crosses = (!_pi.maxBidPrice.isUndef() && _price.lte(_pi.maxBidPrice));
    }
  }
  
  function getMaxAskPriceExternal(PriceIndex storage _pi)
           internal view
           returns (PriceTypeFP maxAskPriceExternal)
  {
    return (_pi.maxAskPrice.isUndef() || _pi.maxAskPrice.isError()) ?
      _pi.maxAskPrice :
      _pi.maxAskPrice.addUint256(_pi.basePriceScaled);
  }
  
  function getMinAskPriceExternal(PriceIndex storage _pi)
           internal view
           returns (PriceTypeFP minAskPriceExternal)
  {
    return (_pi.minAskPrice.isUndef() || _pi.minAskPrice.isError()) ?
      _pi.minAskPrice :
      _pi.minAskPrice.addUint256(_pi.basePriceScaled);
  }
  
  function getMaxBidPriceExternal(PriceIndex storage _pi)
           internal view
           returns (PriceTypeFP maxBidPriceExternal)
  {
    return (_pi.maxBidPrice.isUndef() || _pi.maxBidPrice.isError()) ?
      _pi.maxBidPrice :
      _pi.maxBidPrice.addUint256(_pi.basePriceScaled);
  }
  
  function getMinBidPriceExternal(PriceIndex storage _pi)
           internal view
           returns (PriceTypeFP minBidPriceExternal)
  {
    return (_pi.minBidPrice.isUndef() || _pi.minBidPrice.isError()) ?
      _pi.minBidPrice :
      _pi.minBidPrice.addUint256(_pi.basePriceScaled);
  }

  function getNearestPriceExternal(PriceIndex storage _pi,
                                   PriceTypeFP _priceScaled,
                                   bool _searchAbove) internal view returns (PriceTypeFP nearestPrice)
  {
    PriceTypeFP _price = mapRealScaledToIndexedPrice(_pi, _priceScaled);

    PriceTypeFP nearestPriceInternal = getNearestPriceInternal(_pi, _price, _searchAbove);
    if (nearestPriceInternal.isUndef() || nearestPriceInternal.isError()) {
      nearestPrice = nearestPriceInternal;
    } else {
      nearestPrice = nearestPriceInternal.addUint256(_pi.basePriceScaled);
    }
  }


  function getNearestPriceInternal(PriceIndex storage _pi,
                           PriceTypeFP _indexedPrice,
                           bool _searchAbove) internal view returns (PriceTypeFP nearestPrice)
  {
    uint256 searchPriceBcb15 = (_indexedPrice.toUint256()).decimalToBinaryCodedBase15();
    uint256 resultPriceBcb15;

    uint256 digitIndex = B15_DIGITS;
    bool exactMatch = true;
    uint256 slot;
    uint256 resultBcb15Digit;
    do {
      digitIndex--;

      uint256 bitBucket;
      if (digitIndex == 5) {
        slot = _pi.top;
        bitBucket = slot & MASK_15_BITS;
      } else if (digitIndex == 4) {
        uint256 bitBucketOffset = resultBcb15Digit.binaryCodedBase15ToBucketOffset();
        bitBucket = (slot >> bitBucketOffset) & MASK_15_BITS;
      } else if (digitIndex == 3) {
        uint8 middleIndex = resultPriceBcb15.getMiddleIndex();
        slot = _pi.middle[middleIndex];
        bitBucket = slot & MASK_15_BITS;
      } else if (digitIndex == 2) {
        uint256 bitBucketOffset = resultBcb15Digit.binaryCodedBase15ToBucketOffset();
        bitBucket = (slot >> bitBucketOffset) & MASK_15_BITS;
      } else if (digitIndex == 1) {
        uint8 middleIndex = resultPriceBcb15.getMiddleIndex();
        uint16 bottomIndex = resultPriceBcb15.getBottomIndex(middleIndex);
        slot = _pi.bottom[bottomIndex];
        bitBucket = slot & MASK_15_BITS;
      } else if (digitIndex == 0) {
        uint256 bitBucketOffset = resultBcb15Digit.binaryCodedBase15ToBucketOffset();
        bitBucket = (slot >> bitBucketOffset) & MASK_15_BITS;
      }


      if (exactMatch) {
        uint256 searchBcb15Digit = (searchPriceBcb15 >> (digitIndex * 16)) & MASK_15_BITS;
        if ((bitBucket & searchBcb15Digit) > 0) {
          resultBcb15Digit = searchBcb15Digit;
        } else {
          exactMatch = false;

          uint256 searchDigitBucketIndex = searchBcb15Digit.binaryCodedToValue();
          uint256 nearestBucketIndex = (_searchAbove) ?
                                       bitBucket.getNearestNonZeroBitIndexAboveIndex(searchDigitBucketIndex) :
                                       bitBucket.getNearestNonZeroBitIndexBelowIndex(searchDigitBucketIndex);

          if (nearestBucketIndex == BitBucketLib.ERROR_BIT_INDEX) {
            return PriceLib.UNDEF_PRICE;
          }

          resultBcb15Digit = nearestBucketIndex.valueToBinaryCoded();
        }
      } else {
        uint256 nearestBucketIndex = (_searchAbove) ?
                                     bitBucket.getSmallestNonZeroBitIndex() :
                                     bitBucket.getLargestNonZeroBitIndex();

        if (nearestBucketIndex == BitBucketLib.ERROR_BIT_INDEX) {
            return PriceLib.UNDEF_PRICE;
        }

        resultBcb15Digit = nearestBucketIndex.valueToBinaryCoded();
      }

      resultPriceBcb15 = resultPriceBcb15 | (resultBcb15Digit<< (digitIndex * 16));
    } while (digitIndex != 0);

    nearestPrice = PriceLib.fromUint256(resultPriceBcb15.binaryCodedBase15ToDecimal());
  }

  function getHighestBid(PriceIndex storage _pi) internal view
           returns (PriceTypeFP maxBidPrice) {
    return mapIndexedToRealScaledPrice(_pi, _pi.maxBidPrice);
  }

  function getLowestAsk(PriceIndex storage _pi) internal view
           returns (PriceTypeFP minAskPrice) {
    return mapIndexedToRealScaledPrice(_pi, _pi.minAskPrice);
  }


  function updateMinMaxPrices(PriceIndex storage _pi,
                              PriceTypeFP _indexedPrice,      
                              bool _isBid,
                              bool errorOnCross) internal {
    PriceTypeFP maxAskPrice = _pi.maxAskPrice;
    PriceTypeFP minAskPrice = _pi.minAskPrice;
    PriceTypeFP maxBidPrice = _pi.maxBidPrice;
    PriceTypeFP minBidPrice = _pi.minBidPrice;
    
    if ( errorOnCross &&
         ( (_isBid  && _indexedPrice.gte(minAskPrice)) ||
           (!_isBid && !maxBidPrice.isUndef() && _indexedPrice.lte(maxBidPrice)) ) ) 
    {
      revert AddedPriceCrossesBook(_indexedPrice.toUint256(),
                                   minAskPrice.toUint256(),
                                   maxBidPrice.toUint256());
    }

    if (_isBid) {
      if (maxBidPrice.isUndef() || _indexedPrice.gt(maxBidPrice)) {
        _pi.maxBidPrice = _indexedPrice;
      }
      if (minBidPrice.isUndef() || _indexedPrice.lt(minBidPrice)) {
        _pi.minBidPrice = _indexedPrice;
      }
    } else {
      if (minAskPrice.isUndef() || _indexedPrice.lt(minAskPrice)) {
        _pi.minAskPrice = _indexedPrice;
      }
      if (maxAskPrice.isUndef() || _indexedPrice.gt(maxAskPrice)) {
        _pi.maxAskPrice = _indexedPrice;
      }
    }
  }
  
  function mapRealScaledToIndexedPrice(PriceIndex storage _pi, PriceTypeFP _realPriceScaled)
           internal view
           returns (PriceTypeFP indexedPrice)
  {
    uint256 realPriceScaled = _realPriceScaled.toUint256();

    uint256 maxPriceScaled = _pi.basePriceScaled + MAX_PRICE_INDEX - 1;
    if (realPriceScaled < _pi.basePriceScaled ||
        realPriceScaled > maxPriceScaled) {
      revert ScaledPriceOutOfBounds(realPriceScaled, _pi.basePriceScaled, maxPriceScaled);
    }

    indexedPrice = PriceLib.fromUint256(realPriceScaled - _pi.basePriceScaled);
  }

  function mapIndexedToRealScaledPrice(PriceIndex storage _pi, PriceTypeFP _indexedPrice)
           internal view
           returns (PriceTypeFP realPriceScaled)
  {
    realPriceScaled = _indexedPrice.addUint256(_pi.basePriceScaled);
  }  
}


library BinaryCodingLib {
  function valueToBinaryCoded(uint256 value) internal pure returns (uint256 bcValue) {
    assembly {
      switch value
      case 0  { bcValue :=     1 }
      case 1  { bcValue :=     2 }
      case 2  { bcValue :=     4 }
      case 3  { bcValue :=     8 }
      case 4  { bcValue :=    16 }
      case 5  { bcValue :=    32 }
      case 6  { bcValue :=    64 }
      case 7  { bcValue :=   128 }
      case 8  { bcValue :=   256 }
      case 9  { bcValue :=   512 }
      case 10 { bcValue :=  1024 }
      case 11 { bcValue :=  2048 }
      case 12 { bcValue :=  4096 }
      case 13 { bcValue :=  8192 }
      default { bcValue := 16384 }
    }
  }

  function binaryCodedToValue(uint256 bcValue) internal pure returns (uint256 value) {
    assembly {
      switch bcValue 
      case    1  { value :=    0 }
      case    2  { value :=    1 }
      case    4  { value :=    2 }
      case    8  { value :=    3 }
      case   16  { value :=    4 }
      case   32  { value :=    5 }
      case   64  { value :=    6 }
      case  128  { value :=    7 }
      case  256  { value :=    8 }
      case  512  { value :=    9 }
      case 1024  { value :=   10 }
      case 2048  { value :=   11 }
      case 4096  { value :=   12 }
      case 8192  { value :=   13 }
      default    { value :=   14 }
    }
  }

  function binaryCodedBase15ToBucketOffset(uint256 valueBCB15) internal pure returns (uint256 bucketOffset) {
    assembly {
      switch valueBCB15
      case    1  { bucketOffset :=     15 }
      case    2  { bucketOffset :=     30 }
      case    4  { bucketOffset :=     45 }
      case    8  { bucketOffset :=     60 }
      case   16  { bucketOffset :=     75 }
      case   32  { bucketOffset :=     90 }
      case   64  { bucketOffset :=    105 }
      case  128  { bucketOffset :=    120 }
      case  256  { bucketOffset :=    135 }
      case  512  { bucketOffset :=    150 }
      case 1024  { bucketOffset :=    165 }
      case 2048  { bucketOffset :=    180 }
      case 4096  { bucketOffset :=    195 }
      case 8192  { bucketOffset :=    210 }
      default    { bucketOffset :=    225 }
    }
  }

  function decimalToBinaryCodedBase15(uint256 _valueDec) internal pure returns (uint256 valueBCB15) {
    unchecked {
      valueBCB15 = valueToBinaryCoded(_valueDec % 15);
      uint256 index;
      do {
        index += 16;
        _valueDec /= 15;
        valueBCB15 |= valueToBinaryCoded(_valueDec % 15) << (index);
      } while (index < ((B15_DIGITS-1)*16));
    }
  }

  function binaryCodedBase15ToDecimal(uint256 _valueBCB15) internal pure returns (uint256 valueDec) {
    unchecked {
      valueDec = binaryCodedToValue((_valueBCB15 >> (16*(B15_DIGITS-1))) & MASK_15_BITS) * 15**(B15_DIGITS-1) +
                 binaryCodedToValue((_valueBCB15 >> (16*(B15_DIGITS-2))) & MASK_15_BITS) * 15**(B15_DIGITS-2) +
                 binaryCodedToValue((_valueBCB15 >> (16*(B15_DIGITS-3))) & MASK_15_BITS) * 15**(B15_DIGITS-3) +
                 binaryCodedToValue((_valueBCB15 >> (16*(B15_DIGITS-4))) & MASK_15_BITS) * 15**(B15_DIGITS-4) +
                 binaryCodedToValue((_valueBCB15 >> (16*(B15_DIGITS-5))) & MASK_15_BITS) * 15**(B15_DIGITS-5) +
                 binaryCodedToValue((_valueBCB15 >> (16*(B15_DIGITS-6))) & MASK_15_BITS) * 15**(B15_DIGITS-6);
    }
  }
}

library BitBucketLib {
  using BinaryCodingLib for uint256;

  uint256 constant ERROR_BIT_INDEX = 15;
  uint256 constant MAX_BIT_INDEX = 14;

  function getSmallestNonZeroBitIndex(uint256 _bitBucket) internal pure returns (uint256 bitIndex) {
    unchecked {
      while (bitIndex <= MAX_BIT_INDEX) {
        if (((_bitBucket >> bitIndex) & 1) == 1) {
          break;
        }
        bitIndex++;
      }
    }
  }

  function getLargestNonZeroBitIndex(uint256 _bitBucket) internal pure returns (uint256 bitIndex) {
    bitIndex = ERROR_BIT_INDEX;
    uint256 shifts = ERROR_BIT_INDEX;

    unchecked {
      do {
        shifts--;
        if (((_bitBucket >> shifts) & 1) == 1) {
          bitIndex = shifts;
          break;
        }
      } while (shifts != 0);
    }
  }

  function getNearestNonZeroBitIndexBelowIndex(uint256 _bitBucket, uint256 _index) internal pure
           returns (uint256 bitIndex) {
    if (_index == 0 || _index > MAX_BIT_INDEX) {
      return ERROR_BIT_INDEX;
    }

    bitIndex = ERROR_BIT_INDEX;
    uint256 shifts = _index;
    
    unchecked {
      do {
        shifts--;
        if (((_bitBucket >> shifts) & 1) == 1) {
          bitIndex = shifts;
          break;
        }
      } while (shifts != 0);
    }
  }

  function getNearestNonZeroBitIndexAboveIndex(uint256 _bitBucket, uint256 _index) internal pure
           returns (uint256 bitIndex) {
    if (_index >= MAX_BIT_INDEX) {
      return ERROR_BIT_INDEX;
    }

    bitIndex = ERROR_BIT_INDEX;
    uint256 shifts = _index;

    unchecked {
      do {
        shifts++;
        if (((_bitBucket >> shifts) & 1) == 1) {
          bitIndex = shifts;
          break;
        }
     } while (shifts < MAX_BIT_INDEX);
    }
  }

  function getMiddleIndex(uint256 _valueBCB15) internal pure returns (uint8 middleIndex) {
    unchecked {
      uint256 _middleIndex = ((_valueBCB15 >> (16*(B15_DIGITS-1))) & MASK_15_BITS).binaryCodedToValue() * 15**1 +
                             ((_valueBCB15 >> (16*(B15_DIGITS-2))) & MASK_15_BITS).binaryCodedToValue() * 15**0;

      middleIndex = uint8(_middleIndex);
    }
  }

  function getBottomIndex(uint256 _valueBCB15, uint256 _middleIndex) internal pure returns (uint16 bottomIndex) {
    unchecked {
      uint256 _bottomIndex = _middleIndex * 15**2 +
                             ((_valueBCB15 >> (16*(B15_DIGITS-3))) & MASK_15_BITS).binaryCodedToValue() * 15**1 +
                             ((_valueBCB15 >> (16*(B15_DIGITS-4))) & MASK_15_BITS).binaryCodedToValue() * 15**0;

      bottomIndex = uint16(_bottomIndex);
    }
  }

  function getSlotIndices(uint256 _valueBCB15) internal pure returns (uint8 middleIndex, uint16 bottomIndex) {
    middleIndex = getMiddleIndex(_valueBCB15);
    bottomIndex = getBottomIndex(_valueBCB15, middleIndex);
  }
}
