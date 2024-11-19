// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;


import { PerpContractIdType, PerpContractIdLib } from "./Types.sol";
import { AccountIdType, AccountIdLib, Account, AccountMap } from "./Account.sol";


library TransientCacheLib {
  using AccountIdLib for AccountIdType;
  using PerpContractIdLib for PerpContractIdType;

  uint256 constant BALANCE_BANK = 0;
  uint256 constant PNL_BANK     = 1 << 248;
  
  uint256 constant STATUS_BITS  = 0xFF << 248;
  uint256 constant EXISTS_BIT   = 0x01 << 248;

  function getBalanceSlotAddress(AccountIdType _accountId)
           internal pure
           returns (uint256 slotAddress)
  {
    slotAddress = BALANCE_BANK | _accountId.toUint256();
  }

  function getPnlSlotAddress(AccountIdType _accountId, PerpContractIdType _perpId)
           internal pure
           returns (uint256 slotAddress)
  {
    slotAddress = PNL_BANK | (_accountId.toUint256() << PerpContractIdLib.BITS) | _perpId.toUint256();
  }
  
  function readBalanceEntry(AccountIdType _accountId)
           internal view
           returns (bool existsBalance, uint256 balance)
  {
    uint256 transientStoreAddr = getBalanceSlotAddress(_accountId);
    uint256 rawData;
    assembly {
      rawData := tload(transientStoreAddr)
    }

    existsBalance = (rawData & EXISTS_BIT) == EXISTS_BIT;
    balance = uint256(rawData & (~STATUS_BITS));
  }

  function writeBalanceEntry(AccountIdType _accountId, uint256 _balance)
           internal
  {
    uint256 transientStoreAddr = getBalanceSlotAddress(_accountId);

    uint256 rawData = EXISTS_BIT | _balance;
    assembly {
      tstore(transientStoreAddr, rawData)
    }
  }

  function readPnlEntry(AccountIdType _accountId, PerpContractIdType _perpId)
           internal view
           returns (bool existsPnl, int256 pnl)
  {
    uint256 transientStoreAddr = getPnlSlotAddress(_accountId, _perpId);
    uint256 rawData;
    assembly {
      rawData := tload(transientStoreAddr)
    }

    existsPnl = (rawData & EXISTS_BIT) == EXISTS_BIT;
    pnl = int248(uint248(rawData & (~STATUS_BITS)));
  }

  function writePnlEntry(AccountIdType _accountId, PerpContractIdType _perpId, int256 _pnl)
           internal
  {
    uint256 transientStoreAddr = getPnlSlotAddress(_accountId, _perpId);
    uint256 rawData = EXISTS_BIT | uint256(uint248(int248(_pnl)));
    assembly {
      tstore(transientStoreAddr, rawData)
    }
  }
}
