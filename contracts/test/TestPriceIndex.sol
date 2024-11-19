// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;

import { PriceTypeFP, PriceLib } from "./../Types.sol";
import { PriceIndex, PriceIndexLib, BinaryCodingLib, BitBucketLib } from "./../PriceIndex.sol";

import "hardhat/console.sol";

contract TestPriceIndex {
  using PriceIndexLib for PriceIndex;
  using BitBucketLib for uint256;

  PriceIndex private priceIndex;

  constructor(uint256 _basePriceScaled, uint256 _decimalScaling) {
    priceIndex.init(_basePriceScaled, _decimalScaling);
  }

  function addPrice(PriceTypeFP _price, bool _isBid) public {
    priceIndex.addPrice(_price, _isBid);
  }
  
  function removePrice(PriceTypeFP _price, bool _isBid) public {
    priceIndex.removePrice(_price, _isBid);
  }
  
  function crossesBook(bool _isBid, PriceTypeFP _price) public view
           returns (bool crosses) {
    return priceIndex.crossesBook(_isBid, _price);
  }

  function getNearestPriceExternal(PriceTypeFP _searchPriceScaled, bool _searchAbove) public view
           returns (PriceTypeFP nearestPrice) {
    return priceIndex.getNearestPriceExternal(_searchPriceScaled, _searchAbove);
  }
  
  function getNearestPriceInternal(PriceTypeFP _searchPriceIndexed, bool _searchAbove) public view
           returns (PriceTypeFP nearestPrice) {
    return priceIndex.getNearestPriceInternal(_searchPriceIndexed, _searchAbove);
  }

  function getHighestBid() public view
           returns (PriceTypeFP maxBidPrice) {
    return priceIndex.getMaxBidPriceExternal();
  }
  
  function getLowestBid() public view
           returns (PriceTypeFP minBidPrice) {
    return priceIndex.getMinBidPriceExternal();
  }

  function getHighestAsk() public view
           returns (PriceTypeFP maxAskPrice) {
    return priceIndex.getMaxAskPriceExternal();
  }

  function getLowestAsk() public view
           returns (PriceTypeFP minAskPrice) {
    return priceIndex.getMinAskPriceExternal();
  }

  function updateMinMaxPrices(PriceTypeFP _price, bool _isBid, bool errorOnCross) public {
    priceIndex.updateMinMaxPrices(_price, _isBid, errorOnCross);
  }

  function getMiddleIndex(uint256 _valueBCB15) public pure returns (uint8 middleIndex) {
    middleIndex = BitBucketLib.getMiddleIndex(_valueBCB15);
  }

  function getBottomIndex(uint256 _valueBCB15, uint256 _middleIndex) public pure
           returns (uint16 bottomIndex) {
    bottomIndex = BitBucketLib.getBottomIndex(_valueBCB15, _middleIndex);
  }

  function getSlotIndices(uint256 _valueBCB15) public pure returns (uint8 middleIndex, uint16 bottomIndex) {
    (middleIndex, bottomIndex) = BitBucketLib.getSlotIndices(_valueBCB15);
  }
  
  function decimalToBinaryCodedBase15(uint256 _valueDec) public pure returns (uint256 valueBCB15) {
    valueBCB15 = BinaryCodingLib.decimalToBinaryCodedBase15(_valueDec);
  }
  
  function binaryCodedBase15ToDecimal(uint256 _valueBCB15) public pure returns (uint256 valueDec) {
    valueDec = BinaryCodingLib.binaryCodedBase15ToDecimal(_valueBCB15);
  }
  
  function getSmallestNonZeroBitIndex(uint256 _bitBucket) public pure returns (uint256 bitIndex) {
    bitIndex = _bitBucket.getSmallestNonZeroBitIndex();
  }

  function getLargestNonZeroBitIndex(uint256 _bitBucket) public pure returns (uint256 bitIndex) {
    bitIndex = _bitBucket.getLargestNonZeroBitIndex();
  }

  function getNearestNonZeroBitIndexBelowIndex(uint256 _bitBucket, uint256 _index) public pure
           returns (uint256 bitIndex) {
    bitIndex = _bitBucket.getNearestNonZeroBitIndexBelowIndex(_index);
  }

  function getNearestNonZeroBitIndexAboveIndex(uint256 _bitBucket, uint256 _index) public pure
           returns (uint256 bitIndex) {
    bitIndex = _bitBucket.getNearestNonZeroBitIndexAboveIndex(_index);
  }

  function getTop() public view returns(uint256 slot) {
    return priceIndex.top;
  }

  function getMiddleSlot(uint8 _middleIndex) public view returns(uint256 slot) {
    return priceIndex.middle[_middleIndex];
  }

  function getBottomSlot(uint16 _bottomIndex) public view returns(uint256 slot) {
    return priceIndex.bottom[_bottomIndex];
  }

  function getPriceSlots(uint256 _valueBCB15) public view
           returns (uint256 top, uint256 middle, uint256 bottom) {
    (uint8 middleIndex, uint16 bottomIndex) = BitBucketLib.getSlotIndices(_valueBCB15);
    top = priceIndex.top;
    middle = priceIndex.middle[middleIndex];
    bottom = priceIndex.bottom[bottomIndex];
  }
}
