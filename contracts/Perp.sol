// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;

import { OrderEnum } from "./Enums.sol";
import { PriceTypeFP, PriceLib,
         LotTypeFP, LotLib,
         PerpContractIdType,
         OrderIdType, OrderIdLib,
         OrderSignatureType, OrderSignatureLib } from "./Types.sol";
import { AccountIdType } from "./Account.sol";
import { Order, 
         OrderMapList, OrderMapListLib,
         FQClob, FQClobLib } from "./FQCLOB.sol";
import { PositionMapList } from "./Position.sol";
import { AccountMap } from "./Account.sol";
import { PriceIndex, PriceIndexLib } from "./PriceIndex.sol";

import "hardhat/console.sol";   

error InvalidTimeInForce(uint256 expiryTime, uint256 blockTime);
error UnmatchedLotRemainsInFillOrKill(LotTypeFP unmatchedLot);
error PostOnlyOrderCrossesBook(bool isBid, PriceTypeFP price);


struct PerpContract {
  PerpContractIdType id;

  string name;
  string symbol;

  address admin;
  
  uint256 indexFP;        
  uint256 indexAgeSec;    
  uint256 markFP;
  uint256 markAgeSec;     
  
  uint256 openInterest;

  uint112 balance;
  bool paused;

  FQClob clob;

  PositionMapList positions;

  mapping(uint256 => uint256) fundingProductAtTime;
}

struct OrderResult {
  OrderSignatureType signature;
  uint256 matchCount;
  Order[] matches;
  LotTypeFP unmatchedLot;
}

library PerpContractLib {
  using PriceLib for PriceTypeFP;
  using LotLib for LotTypeFP;
  using OrderIdLib for OrderIdType;
  using OrderMapListLib for OrderMapList;
  using PriceIndexLib for PriceIndex;

  function issueOrder(
    PerpContract storage _perp,
    AccountMap storage _accounts,
    AccountIdType _accountId,
    OrderEnum _orderType,
    PriceTypeFP _price,
    LotTypeFP _lot,
    uint32 _expiryTimeSec,
    bool _postOnly,
    bool _fillOrKill,
    bool _ignoreRemainder,
    uint256 _maxMatches
  ) internal returns (OrderResult memory orderResult) {
    if (_expiryTimeSec > 0 && _expiryTimeSec <= block.timestamp) {
      revert InvalidTimeInForce(_expiryTimeSec, block.timestamp);
    }


    bool isBid = (_orderType == OrderEnum.OpenLong || _orderType == OrderEnum.CloseShort);
    orderResult.unmatchedLot = _lot;
    if (!_postOnly) {
      orderResult = matchOrder(_perp, _accounts, _price, _lot, isBid, _maxMatches);

      if (orderResult.unmatchedLot.gt(0) && _fillOrKill) {
        revert UnmatchedLotRemainsInFillOrKill(orderResult.unmatchedLot);
      }
    } else if (_price.isUndef() || _perp.clob.priceIndex.crossesBook(isBid, _price)) {
      revert PostOnlyOrderCrossesBook(isBid, _price);
    }

    if (!_price.isUndef() && !_ignoreRemainder && orderResult.unmatchedLot.gt(0)) {
      orderResult.signature = FQClobLib.postOrder(_perp.clob, _accountId, _orderType, _price, orderResult.unmatchedLot, _expiryTimeSec, isBid);
    }
  }
  
  uint256 constant MAX_MATCHES = 5;
  function matchOrder(
    PerpContract storage _perp,
    AccountMap storage _accounts,
    PriceTypeFP _price,
    LotTypeFP _lot,
    bool _bid,
    uint256 _maxMatches
  ) internal returns (OrderResult memory orderResult) {
    if (_maxMatches == 0) {
      _maxMatches = MAX_MATCHES;
    }

    orderResult = OrderResult(
      OrderSignatureLib.NULL,
      0,
      new Order[](MAX_MATCHES),
      _lot
    );

    FQClob storage clob = _perp.clob;
    PriceTypeFP currPrice = (_bid) ? clob.priceIndex.getMinAskPriceExternal():
                                     clob.priceIndex.getMaxBidPriceExternal();


    OrderMapList storage orders;
    OrderIdType iter;
    while(orderResult.unmatchedLot.gt(0) && !currPrice.isUndef() && orderResult.matchCount < _maxMatches) {
      if ( !_price.isUndef() && 
           ((_bid && _price.lt(currPrice)) || (!_bid && _price.gt(currPrice))) ) {
        return orderResult;
      }

      orders = clob.priceOrdersMap[currPrice];
      iter = orders.startId;

      while (orderResult.unmatchedLot.gt(0) && !iter.isNull() && orderResult.matchCount < _maxMatches) {
        Order storage order = orders.idOrderMap[iter];

        if (order.timeInForce != 0 && order.timeInForce < block.timestamp) {
          iter = order.nextId;

          orders.deleteOrderFromMapList(order);
        } else {
          (bool success, uint112 depositRequired) =
            FQClobLib.hasSufficientCollateral(_accounts, order, _perp, orderResult.unmatchedLot);

          if (!success) {
            iter = order.nextId;

            orders.deleteOrderFromMapList(order);
          } else {
            if (order.lot.lte(orderResult.unmatchedLot)) {
              orderResult.unmatchedLot = orderResult.unmatchedLot.sub(order.lot);
              
              iter = order.nextId;

              orderResult.matches[orderResult.matchCount++] = order;

              orders.deleteOrderFromMapList(order);
              if (_bid) {
                clob.numAsks--;
              } else {
                clob.numBids--;
              }
            } else {
              orderResult.matches[orderResult.matchCount] = order;
              orderResult.matches[orderResult.matchCount++].lot = orderResult.unmatchedLot;

              order.lot = order.lot.sub(orderResult.unmatchedLot);

              orderResult.unmatchedLot = LotLib.NULL_LOT;
              return orderResult;
            }
          }
        }
      }

      if (iter.isNull()) {
        clob.priceIndex.removePrice(currPrice, _bid);
      }

      if (orderResult.unmatchedLot.gt(0) && orderResult.matchCount < _maxMatches) {
        currPrice = clob.priceIndex.getNearestPriceExternal(currPrice, _bid);
      }
    }
  }

  function setIndex(PerpContract storage _contract, uint256 _indexFP) internal {
    _contract.indexFP = _indexFP;
    _contract.indexAgeSec = block.timestamp;
  }

  function getIndex(PerpContract storage _contract) internal returns (uint256 indexFP) {
    return _contract.indexFP;
  }

  function setMark(PerpContract storage _contract, uint256 _markFP) internal {
    _contract.markFP = _markFP;
    _contract.markAgeSec = block.timestamp;
  }

  function getMark(PerpContract storage _contract) internal returns (uint256 markFP) {
    return _contract.markFP;
  }
}
