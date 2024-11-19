// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;

function divRoundUp(uint256 a, uint256 b) pure returns (uint256)
{

  if (a == 0) {
      return 0;
  } else {
      return 1 + (a - 1) / b;
  }
}

function divRoundFirstDecPlace(uint256 a, uint256 b) pure returns (uint256 result)
{

  if (a == 0) {
      return 0;
  } else {
    result = a / b;

    uint256 scaledRoundToZeroResult = 10 * result;
    uint256 scaledResult = (10 * a) / b;

    uint256 diff = scaledResult - scaledRoundToZeroResult;

    if (diff >= 5) {
      result += 1;
    } 
  }
}

