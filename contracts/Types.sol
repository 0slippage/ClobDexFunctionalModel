// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;




uint256 constant PRICE_DECIMALS = 2;
type PriceTypeFP is uint32;

library PriceLib {
  PriceTypeFP constant ERROR_PRICE = PriceTypeFP.wrap(type(uint32).max);
  PriceTypeFP constant UNDEF_PRICE = PriceTypeFP.wrap(type(uint32).max-1);

  function zero(PriceTypeFP _lhs) internal pure returns (bool) {
    return PriceTypeFP.unwrap(_lhs) == 0;
  }

  function isUndef(PriceTypeFP _lhs) internal pure returns (bool) {
    return PriceTypeFP.unwrap(_lhs) == PriceTypeFP.unwrap(UNDEF_PRICE);
  }

  function isError(PriceTypeFP _lhs) internal pure returns (bool) {
    return PriceTypeFP.unwrap(_lhs) == PriceTypeFP.unwrap(ERROR_PRICE);
  }

  function eq(PriceTypeFP _lhs, PriceTypeFP _rhs) internal pure returns (bool) {
    return PriceTypeFP.unwrap(_lhs) == PriceTypeFP.unwrap(_rhs);
  }

  function lt(PriceTypeFP _lhs, PriceTypeFP _rhs) internal pure returns (bool) {
    return PriceTypeFP.unwrap(_lhs) < PriceTypeFP.unwrap(_rhs);
  }

  function lte(PriceTypeFP _lhs, PriceTypeFP _rhs) internal pure returns (bool) {
    return PriceTypeFP.unwrap(_lhs) <= PriceTypeFP.unwrap(_rhs);
  }

  function gt(PriceTypeFP _lhs, PriceTypeFP _rhs) internal pure returns (bool) {
    return PriceTypeFP.unwrap(_lhs) > PriceTypeFP.unwrap(_rhs);
  }

  function gte(PriceTypeFP _lhs, PriceTypeFP _rhs) internal pure returns (bool) {
    return PriceTypeFP.unwrap(_lhs) >= PriceTypeFP.unwrap(_rhs);
  }

  function inc(PriceTypeFP _lhs) internal pure returns (PriceTypeFP) {
    return PriceTypeFP.wrap(PriceTypeFP.unwrap(_lhs) + 1);
  }
  
  function dec(PriceTypeFP _lhs) internal pure returns (PriceTypeFP) {
    return PriceTypeFP.wrap(PriceTypeFP.unwrap(_lhs) - 1);
  }

  function addUint256(PriceTypeFP _lhs, uint256 _rhs) internal pure returns (PriceTypeFP) {
    return PriceTypeFP.wrap(uint32(
      _rhs + PriceTypeFP.unwrap(_lhs)
    ));
  }
  
  function subUint256(PriceTypeFP _lhs, uint256 _rhs) internal pure returns (PriceTypeFP) {
    return PriceTypeFP.wrap(uint32(
      PriceTypeFP.unwrap(_lhs) - _rhs
    ));
  }

  function toUint256(PriceTypeFP _lhs) internal pure returns (uint256) {
    return PriceTypeFP.unwrap(_lhs);
  }

  function fromUint256(uint256 _lhs) internal pure returns (PriceTypeFP) {
    return PriceTypeFP.wrap(uint32(_lhs));
  }

  function toInt256(PriceTypeFP _lhs) internal pure returns (int256) {
    return int256(uint256(PriceTypeFP.unwrap(_lhs)));
  }
}




type LotTypeFP is uint24;

library LotLib {
  uint256 constant DECIMALS = 2;

  LotTypeFP constant NULL_LOT = LotTypeFP.wrap(0);

  function zero(LotTypeFP _lhs) internal pure returns (bool) {
    return LotTypeFP.unwrap(_lhs) == 0;
  }

  function eq(LotTypeFP _lhs, LotTypeFP _rhs) internal pure returns (bool) {
    return LotTypeFP.unwrap(_lhs) == LotTypeFP.unwrap(_rhs);
  }

  function add(LotTypeFP _lhs, LotTypeFP _rhs) internal pure returns (LotTypeFP sum) {
    sum = LotTypeFP.wrap(LotTypeFP.unwrap(_lhs) + LotTypeFP.unwrap(_rhs));
  }
  
  function sub(LotTypeFP _lhs, LotTypeFP _rhs) internal pure returns (LotTypeFP sum) {
    sum = LotTypeFP.wrap(LotTypeFP.unwrap(_lhs) - LotTypeFP.unwrap(_rhs));
  }
  
  function lte(LotTypeFP _lhs, LotTypeFP _rhs) internal pure returns (bool) {
    return LotTypeFP.unwrap(_lhs) <= LotTypeFP.unwrap(_rhs);
  }
  
  function gt(LotTypeFP _lhs, LotTypeFP _rhs) internal pure returns (bool) {
    return LotTypeFP.unwrap(_lhs) > LotTypeFP.unwrap(_rhs);
  }

  function gt(LotTypeFP _lhs, uint256 _rhs) internal pure returns (bool) {
    return LotTypeFP.unwrap(_lhs) > _rhs;
  }

  function min(LotTypeFP _lhs, LotTypeFP _rhs) internal pure returns (LotTypeFP) {
    return lte(_lhs, _rhs) ? _lhs : _rhs;
  }

  function toUint256(LotTypeFP _lhs) internal pure returns (uint256) {
    return LotTypeFP.unwrap(_lhs);
  }

  function toInt256(LotTypeFP _lhs) internal pure returns (int256) {
    return int256(uint256(LotTypeFP.unwrap(_lhs)));
  }
}




type OrderIdType is uint40;

library OrderIdLib {
  uint256 constant BITS = 40;

  OrderIdType constant NULL = OrderIdType.wrap(0);
  OrderIdType constant FIRST = OrderIdType.wrap(1);

  function isNull(OrderIdType _lhs) internal pure returns (bool) {
    return OrderIdType.unwrap(_lhs) == OrderIdType.unwrap(NULL);
  }

  function eq(OrderIdType _lhs, OrderIdType _rhs) internal pure returns (bool) {
    return OrderIdType.unwrap(_lhs) == OrderIdType.unwrap(_rhs);
  }
  
  function inc(OrderIdType _lhs) internal pure returns (OrderIdType) {
    return OrderIdType.wrap(OrderIdType.unwrap(_lhs) + 1);
  }
}




type OrderSignatureType is uint256;

library OrderSignatureLib {
  using OrderIdLib for OrderIdType;

  OrderSignatureType constant NULL = OrderSignatureType.wrap(0);

  function encodeOrderSignature(
    PriceTypeFP _price,
    OrderIdType _orderId
  ) internal pure returns (OrderSignatureType signature) {
    signature = OrderSignatureType.wrap(
      (uint256(PriceTypeFP.unwrap(_price)) << OrderIdLib.BITS) |
      uint256(OrderIdType.unwrap(_orderId))
    );
  }

  uint256 constant ORDER_ID_MASK = (2 ** OrderIdLib.BITS) - 1;

  function decodeOrderSignature(
    OrderSignatureType _signature
  ) internal pure returns (PriceTypeFP price, OrderIdType orderId) {
    orderId = OrderIdType.wrap(uint40(OrderSignatureType.unwrap(_signature) & ORDER_ID_MASK));
    price = PriceTypeFP.wrap(uint32(OrderSignatureType.unwrap(_signature) >> OrderIdLib.BITS));
  }
  
  function toUint256(OrderSignatureType _lhs) internal pure returns (uint256) {
    return OrderSignatureType.unwrap(_lhs);
  }
}




type PerpContractIdType is uint16;

library PerpContractIdLib {
  uint256 constant MAX = type(uint16).max;
  uint256 constant BITS = 16;

  function zero(PerpContractIdType _lhs) internal pure returns (bool) {
    return PerpContractIdType.unwrap(_lhs) == 0;
  }
  
  function inc(PerpContractIdType _lhs) internal pure returns (PerpContractIdType) {
    return PerpContractIdType.wrap(PerpContractIdType.unwrap(_lhs) + 1);
  }
  
  function dec(PerpContractIdType _lhs) internal pure returns (PerpContractIdType) {
    return PerpContractIdType.wrap(PerpContractIdType.unwrap(_lhs) - 1);
  }
  
  function lte(PerpContractIdType _lhs, PerpContractIdType _rhs) internal pure returns (bool) {
    return PerpContractIdType.unwrap(_lhs) <= PerpContractIdType.unwrap(_rhs);
  }
  
  function lte(PerpContractIdType _lhs, uint256 _rhs) internal pure returns (bool) {
    return PerpContractIdType.unwrap(_lhs) <= _rhs;
  }
  
  function gt(PerpContractIdType _lhs, uint256 _rhs) internal pure returns (bool) {
    return PerpContractIdType.unwrap(_lhs) > _rhs;
  }

  function toUint256(PerpContractIdType _lhs) internal pure returns (uint256) {
    return PerpContractIdType.unwrap(_lhs);
  }

  function fromUint256(uint256 _lhs) internal pure returns (PerpContractIdType) {
    return PerpContractIdType.wrap(uint16(_lhs));
  }
}
