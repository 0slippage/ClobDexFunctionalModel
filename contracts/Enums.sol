// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;

enum OrderEnum {
  OpenLong, 
  OpenShort, 
  CloseLong, 
  CloseShort 
}

enum PositionEnum {
  Long,
  Short
}

enum PositionChangeEnum {
  Adding,
  Reducing,
  Inverting
}
