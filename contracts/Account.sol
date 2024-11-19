// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;


type AccountIdType is uint40;


library AccountIdLib {
  uint256 constant BITS = 40;

  AccountIdType constant NULL = AccountIdType.wrap(0);
  AccountIdType constant FIRST = AccountIdType.wrap(1);

  function eq(AccountIdType _lhs, AccountIdType _rhs) internal pure returns (bool) {
    return AccountIdType.unwrap(_lhs) == AccountIdType.unwrap(_rhs);
  }
  
  function lt(AccountIdType _lhs, AccountIdType _rhs) internal pure returns (bool) {
    return AccountIdType.unwrap(_lhs) < AccountIdType.unwrap(_rhs);
  }

  function isNull(AccountIdType _accountId) internal pure returns (bool) {
    return AccountIdType.unwrap(_accountId) == AccountIdType.unwrap(NULL);
  }
  
  function isFirst(AccountIdType _accountId) internal pure returns (bool) {
    return AccountIdType.unwrap(_accountId) == AccountIdType.unwrap(FIRST);
  }
  
  function inc(AccountIdType _accountId) internal pure returns (AccountIdType) {
    return AccountIdType.wrap(AccountIdType.unwrap(_accountId) + 1);
  }
  
  function dec(AccountIdType _accountId) internal pure returns (AccountIdType) {
    return AccountIdType.wrap(AccountIdType.unwrap(_accountId) - 1);
  }

  function toUint256(AccountIdType _lhs) internal pure returns (uint256) {
    return AccountIdType.unwrap(_lhs);
  }
}


struct Account {
  uint24 leverage;       
  uint112 balance;       
  bool liquidator;       
  uint256 positionIndicator;    
  uint256 positions60Plus;      
  uint256 positions316Plus;     
  uint256 positions572Plus;     
}


struct AccountMap {
  AccountIdType nextAccountId;

  mapping(AccountIdType => Account) idNodeMap;
  mapping(address => AccountIdType) addressIdMap;
}
