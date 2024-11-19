// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;


import { PositionEnum } from "./Enums.sol";
import { PriceTypeFP, LotTypeFP } from "./Types.sol";
import { AccountIdType, AccountIdLib } from "./Account.sol";


struct Position {
  AccountIdType nextNodeId;
  AccountIdType prevNodeId;

  PositionEnum positionType;
  uint112 deposit;            
  PriceTypeFP price;          
  LotTypeFP lot;              

  uint32 entryTime;   
}


struct PositionMapList {
  AccountIdType startNodeId;
  AccountIdType endNodeId;
  mapping(AccountIdType => Position) idNodeMap;
}


library PositionMapListLib {
  using AccountIdLib for AccountIdType;

  function append(PositionMapList storage _positions,
                  AccountIdType _id,
                  Position memory _position)
           internal
  {
    if (_positions.startNodeId.isNull()) {
      _positions.startNodeId = _id;
    } else {
      _position.prevNodeId = _positions.endNodeId;

      Position storage lastPosition = _positions.idNodeMap[_positions.endNodeId];
      lastPosition.nextNodeId = _id;
    }

    _positions.idNodeMap[_id] = _position;
    _positions.endNodeId = _id;
  }

  function remove(PositionMapList storage _positions, AccountIdType _id)
           internal
  {
    Position storage position = _positions.idNodeMap[_id];

    if (position.deposit!= 0) {

      if (_id.eq(_positions.startNodeId)) {
        _positions.startNodeId = position.nextNodeId;
      } else {
        Position storage prev = _positions.idNodeMap[position.prevNodeId];
        prev.nextNodeId = position.nextNodeId;
      }

      if (_id.eq(_positions.endNodeId)) {
        _positions.endNodeId = position.prevNodeId;
      } else {
        Position storage next = _positions.idNodeMap[position.nextNodeId];
        next.prevNodeId = position.prevNodeId;
      }

      delete _positions.idNodeMap[_id];
    }
  }
}
