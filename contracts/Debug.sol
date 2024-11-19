// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;

import "hardhat/console.sol";   

import { OrderEnum, PositionEnum } from "./Enums.sol";
import { PriceTypeFP, PriceLib,
         LotTypeFP, LotLib,
         PerpContractIdType, PerpContractIdLib } from "./Types.sol";
import { Account, AccountIdType, AccountIdLib, AccountMap } from "./Account.sol";
import { Order } from "./FQCLOB.sol";
import { Position, PositionMapList } from "./Position.sol";
import { PerpContract, OrderResult } from "./Perp.sol";
import { PerpContractMap } from "./Vault.sol";


using AccountIdLib for AccountIdType;
using PriceLib for PriceTypeFP;
using LotLib for LotTypeFP;

function getOrderEnumStr(OrderEnum _orderType) 
         pure returns (string memory orderString)
{
  if (_orderType == OrderEnum.OpenLong) {
    orderString = "OpenLong";
  } else if (_orderType == OrderEnum.OpenShort) {
    orderString = "OpenShort";
  } else if (_orderType == OrderEnum.CloseLong) {
    orderString = "CloseLong";
  } else if (_orderType == OrderEnum.CloseShort) {
    orderString = "CloseShort";
  }
}

function getPositionEnumStr(PositionEnum _positionType)
         pure returns (string memory positionString)
{
  if (_positionType == PositionEnum.Long) {
    positionString = "Long";
  } else if (_positionType == PositionEnum.Short) {
    positionString = "Short";
  }
}

function dumpMatch(Order memory _match, uint256 _index, bool _showIndex) view
{
  if (_showIndex) {
    console.log("\n    Match #%d          ", _index);
  } else {
    console.log("");
  }
  console.log("    Account %d         ", _match.accountId.toUint256());
  console.log("    OrderEnum %s       ", getOrderEnumStr(_match.orderType));
  console.log("    Price %d           ", _match.price.toUint256());
  console.log("    Lot %d             ", _match.lot.toUint256());
  console.log("    TIF %d (current=%d)", _match.timeInForce, block.timestamp);
}

function dumpMatches(OrderResult memory result) view
{
    console.log("Matches\n- - - - - - - - - - - - - - - - - - - - ");
    for (uint256 matchIndex = 0; matchIndex < result.matchCount; matchIndex++) {
      Order memory matchOrder = result.matches[matchIndex];
      dumpMatch(matchOrder, matchIndex, true);
    }
    console.log("");
}

function dumpPosition(Position storage _position,
                      AccountIdType _ownerId,
                      uint256 _index,
                      bool _showIndex,
                      string memory _indent) view
{
  if (_showIndex) {
    console.log("\n    Position Index %d", _index);
  } else {
    console.log("");
  }
  console.log("%sOwner ID:      %d", _indent, _ownerId.toUint256());
  console.log("%sPosition Type: %s", _indent, getPositionEnumStr(_position.positionType));
  console.log("%sPrice:         %d", _indent, _position.price.toUint256());
  console.log("%sLot:           %d", _indent, _position.lot.toUint256());
  console.log("%sDeposited:     %d", _indent, _position.deposit);
}

function dumpPositions(PositionMapList storage _positions) view
{
  AccountIdType positionId = _positions.startNodeId;
  uint256 positionIndex = 0;
  
  console.log("Positions\n- - - - - - - - - - - - - - - - - - - - ");
  do {
    Position storage position = _positions.idNodeMap[positionId];
    if (position.price.isUndef()) {
      console.log("Invalid position. Breaking.");
      break;
    }

    dumpPosition(position, positionId, positionIndex++, true, "    ");

    positionId = position.nextNodeId;
  } while (!positionId.isNull());
  
  console.log("");
}

function dumpAccount(Account storage _account,
                     PerpContractMap storage _contracts,
                     AccountIdType _accountId) view
{
  console.log("\n    Account ID:         %d", _accountId.toUint256());
  console.log("    Is liquidator:      %s", (_account.liquidator ? "Yes" : "No"));
  console.log("    Collateral Balance: %d", _account.balance);

  bool printedHeader = false;
  uint256 positionIndicator = _account.positionIndicator;
  for (uint256 index = 0; index <= 62; index++) {
    if (((positionIndicator >> index) & 1) == 1) {
      if (!printedHeader) {
        console.log("    Account Positions:");
        console.log("    - - - - - - - - - - ");
        printedHeader = true;
      }

      uint256 id;
      if (index < 60) {
        id = index;
      } if (index == 60) {
        console.log("    Bank1: true");
      } else if (index == 61) {
        console.log("    Bank2: true");
      } else if (index == 62) {
        console.log("    Bank3: true");
      }
      
      PerpContract storage perp = _contracts.map[PerpContractIdLib.fromUint256(id)];
      Position storage position = perp.positions.idNodeMap[_accountId];
      if (position.deposit != 0) {
        dumpPosition(position, _accountId, 0, false, "        ");
        console.log("        Perp ID:       %d", id);
      }
    }
  }
}

function dumpAccounts(AccountMap storage _accounts,
                      PerpContractMap storage _contracts) view {
  console.log("Accounts\n- - - - - - - - - - - - - - - - - - - - ");
  for (AccountIdType accountId = AccountIdLib.FIRST;
       accountId.lt(_accounts.nextAccountId);
       accountId = accountId.inc()) {
    Account storage account = _accounts.idNodeMap[accountId];
    dumpAccount(account, _contracts, accountId);
  }
  console.log("");
}
