// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;

import { OrderEnum, PositionEnum, PositionChangeEnum } from "./Enums.sol";
import { PriceTypeFP, PriceLib,
         LotTypeFP, LotLib,
         OrderIdType, OrderIdLib,
         OrderSignatureType, OrderSignatureLib,
         PerpContractIdType, PerpContractIdLib } from "./Types.sol";
import { Account,
         AccountMap,
         AccountIdType, AccountIdLib } from "./Account.sol";
import { PriceIndex, PriceIndexLib } from "./PriceIndex.sol";
import { TransientCacheLib } from "./TransientCache.sol";
import { PerpContract } from "./Perp.sol";
import { Position } from "./Position.sol";
import { INIT_MARGIN, 
         MAINT_MARGIN,
         PCT_DENOMINATOR,
         MAX_CONTRACT_ID_MGROUP2 } from "./Vault.sol";


import "hardhat/console.sol";   

uint32 constant NO_TIF = 0;


struct Order {
  AccountIdType accountId;
  OrderEnum orderType;
  PriceTypeFP price;
  LotTypeFP lot;
  uint32 timeInForce;
  OrderIdType id;
  OrderIdType prevId;
  OrderIdType nextId;
}

struct OrderMapList {
  OrderIdType nextOrderId;
  OrderIdType startId;
  OrderIdType endId;
  mapping(OrderIdType => Order) idOrderMap;
}


struct FQClob {
  uint32 numBids;
  uint32 numAsks;
  PriceIndex priceIndex;
  mapping(PriceTypeFP => OrderMapList) priceOrdersMap;
}

library FQClobLib {
  using PriceLib for PriceTypeFP;
  using LotLib for LotTypeFP;
  using OrderIdLib for OrderIdType;
  using OrderSignatureLib for OrderSignatureType;
  using PriceIndexLib for PriceIndex;
  using OrderMapListLib for OrderMapList;
  using TransientCacheLib for AccountIdType;
  using PerpContractIdLib for PerpContractIdType;

  LotTypeFP constant MIN_LOT = LotTypeFP.wrap(1);

  function postOrder(
    FQClob storage _clob,
    AccountIdType _accountId,
    OrderEnum _orderType,
    PriceTypeFP _price,
    LotTypeFP _lot,
    uint32 _expiryTimeSec,
    bool _bid
  ) internal returns (OrderSignatureType signature) {

    OrderMapList storage orders = _clob.priceOrdersMap[_price];
    bool emptyList = orders.startId.isNull();

    OrderIdType prevId; 
    if (emptyList) {
      orders.nextOrderId = OrderIdLib.FIRST;

      _clob.priceIndex.addPrice(_price, _bid);
    } else {
      prevId = orders.endId;
    }

    OrderIdType orderId = orders.getNextOrderId();
    orders.idOrderMap[orderId] = Order(
      _accountId,
      _orderType,
      _price,
      _lot,
      _expiryTimeSec,
      orderId,
      prevId,
      OrderIdLib.NULL 
    );
    if (_bid) {
      _clob.numBids++;
    } else {
      _clob.numAsks++;
    }

    if (emptyList) {
      orders.startId = orderId;
      orders.endId = orderId;
    } else {
      orders.idOrderMap[orders.endId].nextId = orderId;
      orders.endId = orderId;
    }

    signature = OrderSignatureLib.encodeOrderSignature(_price, orderId);
  }


  function cancelOrder(FQClob storage _clob, OrderSignatureType _signature) internal {
    (PriceTypeFP price, OrderIdType orderId) = _signature.decodeOrderSignature();

    OrderMapList storage orders = _clob.priceOrdersMap[price];
    Order storage order = orders.idOrderMap[orderId];
    OrderEnum orderType = order.orderType;
    bool isBid = (orderType == OrderEnum.OpenLong || orderType == OrderEnum.CloseShort);

    if (order.price.zero() && order.lot.zero()) {
    }

    if (orders.startId.eq(order.id) && orders.endId.eq(order.id) && !order.id.isNull()) {
      _clob.priceIndex.removePrice(order.price, isBid);
    }

    orders.deleteOrderFromMapList(order);

    if (isBid) {
      _clob.numBids--;
    } else {
      _clob.numAsks--;
    }

  }

  function calculateIMR(PriceTypeFP _price, LotTypeFP _lot)
           internal pure
           returns (uint256 initialMarginRequired)
  {
    initialMarginRequired = (_price.toUint256() * _lot.toUint256() * INIT_MARGIN) / PCT_DENOMINATOR;
  }
  
  function calculateMMR(PriceTypeFP _price, LotTypeFP _lot)
           internal pure
           returns (uint256 maintMarginRequired)
  {
    maintMarginRequired = (_price.toUint256() * _lot.toUint256() * MAINT_MARGIN) / PCT_DENOMINATOR;
  }

  function calculatePremiumPnl(PerpContract storage _perp, uint256 _entryTimestamp)
           internal pure
           returns (int256 pnl)
  {
  }

  function calculatePnl(PerpContract storage _perp, Position storage _position)
           internal view 
           returns (int256 pnl)
  {
    int256 deltaPnl = int256(_perp.indexFP) - _position.price.toInt256();
    
    int256 premiumPnl = calculatePremiumPnl(_perp, uint256(_position.entryTime));

    pnl = (deltaPnl + premiumPnl) * _position.lot.toInt256();
  }

  function getPositionChangeType(PositionEnum _positionType,
                                 LotTypeFP _positionLot,
                                 OrderEnum _orderType,
                                 LotTypeFP _orderLot)
           internal pure
           returns (PositionChangeEnum positionChangeType)
  {
    PositionEnum orderPositionType =
      ( _orderType == OrderEnum.OpenLong ||
        _orderType == OrderEnum.CloseShort ) ?
      PositionEnum.Long : PositionEnum.Short;

    if (_positionType == orderPositionType) {
      positionChangeType = PositionChangeEnum.Adding;
    } else if (_orderLot.lte(_positionLot)) {
      positionChangeType = PositionChangeEnum.Reducing;
    } else {
      positionChangeType = PositionChangeEnum.Inverting;
    }
  }

  function hasSufficientCollateral(AccountMap storage _accounts,
                                   Order storage _order,
                                   PerpContract storage _perp,
                                   LotTypeFP _unmatchedLot)
           internal
           returns (bool success, uint112 depositRequired)
  {
    if (_perp.id.gt(MAX_CONTRACT_ID_MGROUP2)) {
      Position storage p = _perp.positions.idNodeMap[_order.accountId];
      if (p.deposit == 0) {
        LotTypeFP matchLot = LotLib.min(_order.lot, _unmatchedLot);
        depositRequired = uint112(calculateIMR(_order.price, matchLot));

        (bool existsBalance, uint256 balance) = _order.accountId.readBalanceEntry();
        if (!existsBalance) {
          balance = _accounts.idNodeMap[_order.accountId].balance;
        }
        success = balance >= depositRequired;

        _order.accountId.writeBalanceEntry(balance - depositRequired);
      } else {
        LotTypeFP matchLot = LotLib.min(_order.lot, _unmatchedLot);
        PositionChangeEnum positionChangeType = 
          getPositionChangeType(p.positionType, p.lot, _order.orderType, matchLot);

        if (positionChangeType == PositionChangeEnum.Adding) {
          depositRequired = uint112(calculateIMR(_order.price, matchLot));
        
          (bool existsBalance, uint256 balance) = _order.accountId.readBalanceEntry();
          if (!existsBalance) {
            balance = _accounts.idNodeMap[_order.accountId].balance;
          }
          success = balance >= depositRequired;

          if (!success) {
            (bool existsPnl, int256 cachedPnl) = _order.accountId.readPnlEntry(_perp.id);
            int256 positionPnl = (existsPnl) ? cachedPnl : calculatePnl(_perp, p);

            if (positionPnl > 0) {
              if ((uint256(positionPnl) + balance) >= depositRequired) {
                int256 consumedPnl = int256(uint256(depositRequired - balance));
                _order.accountId.writePnlEntry(_perp.id, positionPnl - consumedPnl);

                depositRequired = uint112(balance);
                success = true;

                _order.accountId.writeBalanceEntry(0);
              }
            }
          }
        } else if (positionChangeType == PositionChangeEnum.Reducing) {
          success = true;

          (bool existsPnl, int256 cachedPnl) = _order.accountId.readPnlEntry(_perp.id);
          int256 positionPnl = (existsPnl) ? cachedPnl : calculatePnl(_perp, p);

          uint256 matchDeposit;   
          int256 matchPnl;
          if (p.lot.gt(matchLot)) {
            matchPnl = (positionPnl * matchLot.toInt256()) / p.lot.toInt256();
            positionPnl -= matchPnl;

            matchDeposit = (uint256(p.deposit) * matchLot.toUint256()) / p.lot.toUint256();
          } else {
            matchPnl = positionPnl;
            matchDeposit = p.deposit;
          }
          int256 proceeds = int256(matchDeposit) + positionPnl;

          (bool existsBalance, uint256 balance) = _order.accountId.readBalanceEntry();
          if (!existsBalance) {
            balance = _accounts.idNodeMap[_order.accountId].balance;
          }

          if (proceeds > 0) {
            balance += uint256(proceeds);
          } else {
          }

          _order.accountId.writeBalanceEntry(balance);
          if (positionPnl != matchPnl) {
            _order.accountId.writePnlEntry(_perp.id, positionPnl - matchPnl);
          }
        } else { 
        }
      }
    } else {
    }
  }
  
  struct BookEntry {
    PriceTypeFP price;
    LotTypeFP bids;
    LotTypeFP asks;
  }
  uint256 constant MAX_BOOK_ENTRIES = 10;
  function getContractBookSummary(FQClob storage _clob) internal view
           returns (uint256 maxBidPrice, 
                    uint256 minBidPrice,
                    uint256 maxAskPrice,
                    uint256 minAskPrice,
                    BookEntry[] memory bookEntries)
  {
    maxBidPrice = _clob.priceIndex.getMaxBidPriceExternal().toUint256();
    maxBidPrice = _clob.priceIndex.getMaxBidPriceExternal().toUint256();
    maxAskPrice = _clob.priceIndex.getMaxAskPriceExternal().toUint256();
    minAskPrice = _clob.priceIndex.getMinAskPriceExternal().toUint256();

    bookEntries = new BookEntry[](MAX_BOOK_ENTRIES);
   
    uint256 index;
    if (minAskPrice != 0) {
      uint256 maximum = ((minAskPrice + 4) > type(uint32).max) ? type(uint32).max : minAskPrice + 4;
      for (uint256 price = maximum; price >= minAskPrice; price--) {
        (, LotTypeFP asks) = (_clob.priceOrdersMap[PriceLib.fromUint256(price)]).getVolumeAtPrice();
        bookEntries[index++] = BookEntry(PriceLib.fromUint256(price), LotLib.NULL_LOT, asks);
      }
    }
    
    if (maxBidPrice != 0) {
      uint256 minimum = (maxBidPrice >= 4) ? maxBidPrice - 4 : 0;
      for (uint256 price = maxBidPrice; (price >= minimum); price--) {
        (LotTypeFP bids,) = (_clob.priceOrdersMap[PriceLib.fromUint256(price)]).getVolumeAtPrice();
        bookEntries[index++] = BookEntry(PriceLib.fromUint256(price), bids, LotLib.NULL_LOT);
      }
    }
  }
}

library OrderMapListLib {
  using OrderIdLib for OrderIdType;
  using LotLib for LotTypeFP;
  
  function deleteOrderFromMapList(OrderMapList storage _orders, Order storage _order) internal {
    OrderIdType id = _order.id;


    if (id.eq(_orders.startId)) {
      _orders.startId = _order.nextId;
    } else {
      Order storage prev = _orders.idOrderMap[_order.prevId];
      prev.nextId = _order.nextId;
    }

    if (id.eq(_orders.endId)) {
      _orders.endId = _order.prevId;
    } else {
      Order storage next = _orders.idOrderMap[_order.nextId];
      next.prevId = _order.prevId;
    }

    delete _orders.idOrderMap[id];

  }

  function getVolumeAtPrice(OrderMapList storage _orderMapList) internal view
           returns (LotTypeFP bids, LotTypeFP asks) {
    OrderIdType index = _orderMapList.startId;
    while (!index.isNull()) {
      Order storage order = _orderMapList.idOrderMap[index];

      if (order.timeInForce == 0 || order.timeInForce > block.timestamp) {
        if (order.orderType == OrderEnum.OpenLong || order.orderType == OrderEnum.CloseShort) {
          bids = bids.add(order.lot);
        } else {
          asks = asks.add(order.lot);
        }
      }

      index = order.nextId;
    }
  }

  function getNextOrderId(OrderMapList storage orders) internal returns (OrderIdType orderId) {
    orderId = orders.nextOrderId;

    orders.nextOrderId = orders.nextOrderId.inc();

    if (orders.nextOrderId.isNull()) {
      orders.nextOrderId = OrderIdLib.FIRST;
    }
  }
}

