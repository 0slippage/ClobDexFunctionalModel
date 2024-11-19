// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.28;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {

  uint8 private tokenDecimals;

  constructor(string memory _name, string memory _symbol, uint8 _decimals) ERC20(_name, _symbol) {
    tokenDecimals = _decimals;
  }

  function decimals() public view virtual override returns (uint8) {
    return tokenDecimals;
  }

  function mint(address account, uint256 amount) public {
    _mint(account, amount);
  }
}
