pragma solidity ^0.8.28;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { OrderEnum, PositionEnum } from "./Enums.sol";
import { PriceTypeFP, PriceLib,
         LotTypeFP, LotLib,
         OrderIdType, OrderIdLib,
         OrderSignatureType, OrderSignatureLib,
         PerpContractIdType, PerpContractIdLib } from "./Types.sol";
import { AccountIdType, AccountIdLib, Account, AccountMap } from "./Account.sol";
import { Order, FQClob, FQClobLib, NO_TIF } from "./FQCLOB.sol";
import { PriceIndex, PriceIndexLib } from "./PriceIndex.sol";
import { PerpContract, PerpContractLib, OrderResult } from "./Perp.sol";
import { Position, PositionMapList, PositionMapListLib } from "./Position.sol";

import { dumpMatches, dumpPositions, dumpAccounts, dumpAccount } from "./Debug.sol";
import "hardhat/console.sol";   


address constant NULL_ADDR = address(0);

uint256 constant USDT_DECIMALS = 6;
uint112 constant MIN_OPEN_ACCOUNT_AMT = uint112(200 * (10 ** USDT_DECIMALS));

uint24 constant PCT_MINIMUM = 1;
uint24 constant PCT_DENOMINATOR = 100_000;
uint24 constant INIT_MARGIN = 10_000 * PCT_MINIMUM;           
uint24 constant MAINT_MARGIN = 5_000 * PCT_MINIMUM;           
uint24 constant MAKER_FEE = 10 * PCT_MINIMUM;                 
uint24 constant TAKER_FEE = 35 * PCT_MINIMUM;                 
uint256 constant MIN_CONTRACT_ID_MGROUP1 = 0;
uint256 constant MAX_CONTRACT_ID_MGROUP1 = 15;
uint256 constant MIN_CONTRACT_ID_MGROUP2 = 16;
uint256 constant MAX_CONTRACT_ID_MGROUP2 = 31;
uint256 constant MAX_CONTRACT_ID = 818;  


error SenderIsNotAdmin(address sender, address admin);
error ContractDoesNotExist(PerpContractIdType id);
error ContractCannotBeRemoved(PerpContractIdType id);
error ContractIsPaused(PerpContractIdType id);

error InsufficentAmountToOpenAccount(address sender, uint256 amount);
error AccountExists(address sender, AccountIdType id);
error AccountDoesNotExist(address accountAddress);
error NoAccountsRemain();

error WithdrawAmountExceedsBalance(uint256 amount, uint256 balance);

error PositionDoesNotExist(AccountIdType accountId, PerpContractIdType perpId);

error InsufficientFundsForOperation(uint256 balance, uint256 amount);

error ContractIdExceedsMaximum(uint256 id);
error ContractIdInUse(uint256 id);


struct PerpContractMap {
  PerpContractIdType nextPerpContractId;
  PerpContractIdType numPerpContracts;
  mapping(PerpContractIdType => PerpContract) map;
}

  
contract Vault {
  using SafeERC20 for IERC20Metadata;
  using AccountIdLib for AccountIdType;

  using OrderIdLib for OrderIdType;
  using OrderSignatureLib for OrderSignatureType;

  using PerpContractIdLib for PerpContractIdType;
  using PerpContractLib for PerpContract;
  using PriceLib for PriceTypeFP;
  using LotLib for LotTypeFP;
  using FQClobLib for FQClob;
  using PriceIndexLib for PriceIndex;

  using PositionMapListLib for PositionMapList;

  address admin;

  address collateralToken;

  uint112 minAccountOpen;

  uint112 balance;

  PerpContractMap private contracts;
  AccountMap private accounts;

  event OrderPlaced(
    address indexed owner,
    uint256 contractId,
    uint256 OrderSignature
  );

  modifier senderIsAdmin() {
    _senderIsAdmin(); 
    _;
  }

  function _senderIsAdmin() internal view {
    if (msg.sender != admin) {
      revert SenderIsNotAdmin(msg.sender, admin);
    }
  }

  constructor(address _admin, address _collateralToken) {
    admin = _admin;
    accounts.nextAccountId = AccountIdLib.FIRST;

    collateralToken = _collateralToken;

    minAccountOpen = MIN_OPEN_ACCOUNT_AMT;
  }


  function setMinAccountOpenAmount(uint256 _amount) public senderIsAdmin {
    minAccountOpen = uint112(_amount);

  }

  function addContract(string memory _name,
                       string memory _symbol,
                       PerpContractIdType _id,
                       uint256 basePriceScaled,
                       uint256 decimalScaling) public senderIsAdmin
  {
    if (_id.gt(MAX_CONTRACT_ID)) {
      revert ContractIdExceedsMaximum(_id.toUint256());
    }
    
    PerpContract storage pc = contracts.map[_id];
    if (pc.admin != NULL_ADDR) {
      revert ContractIdInUse(_id.toUint256());
    }

    pc.id = _id;
    pc.name = _name;
    pc.symbol = _symbol;
    pc.admin = msg.sender;
    pc.paused = true;
    pc.clob.priceIndex.init(basePriceScaled, decimalScaling);

    contracts.numPerpContracts = contracts.numPerpContracts.inc();
  }
  
  function removeContract(PerpContractIdType _id) public senderIsAdmin {
    PerpContract storage perp = contracts.map[_id];

    if (!existsPerpContract(perp)) {
      revert ContractDoesNotExist(_id);
    }

    if (perp.openInterest != 0 || !perp.paused) {
      revert ContractCannotBeRemoved(_id);
    }

    delete contracts.map[_id];
    contracts.numPerpContracts = contracts.numPerpContracts.dec();
  }

  function updateContract() public senderIsAdmin {
  }

  function togglePauseContract(PerpContractIdType _id) public senderIsAdmin {
    PerpContract storage perp = contracts.map[_id];
    
    if (!existsPerpContract(perp)) {
      revert ContractDoesNotExist(_id);
    }
    perp.paused = !perp.paused;
  }

  function unwindContract() public senderIsAdmin {
  }

  function getContractInfo(PerpContractIdType _id) public view
           returns (string memory name,
                    string memory symbol,
                    uint256 indexFP,
                    uint256 markFP,
                    uint256 openInterest,
                    bool paused) {
    PerpContract storage perp = contracts.map[_id];
    
    if (!existsPerpContract(perp)) {
      revert ContractDoesNotExist(_id);
    }

    name = perp.name;
    symbol = perp.symbol;
    indexFP = perp.indexFP;
    markFP = perp.markFP;
    openInterest = perp.openInterest;
    paused = perp.paused;
  }
  
  function getContractBookSummary(PerpContractIdType _id) public view
           returns (uint256 maxBidPrice, 
                    uint256 minBidPrice,
                    uint256 maxAskPrice,
                    uint256 minAskPrice,
                    FQClobLib.BookEntry[] memory bookEntries)
  {
    PerpContract storage perp = contracts.map[_id];
    
    if (!existsPerpContract(perp)) {
      revert ContractDoesNotExist(_id);
    }

    return perp.clob.getContractBookSummary();
  }


  function numberOfContracts() public view returns (PerpContractIdType numPerpContracts) {
    return contracts.numPerpContracts;
  }

  function numberOfAccounts() public view returns (AccountIdType) {
    return accounts.nextAccountId;
  }

  function addLiquidator(address _liquidator)  public senderIsAdmin {
    AccountIdType accountId = accounts.addressIdMap[_liquidator];
    if (accountId.isNull()) {
      revert AccountDoesNotExist(_liquidator);
    }

    accounts.idNodeMap[accountId].liquidator = true;
  }

  function removeLiquidator(address _liquidator) public senderIsAdmin {
    AccountIdType accountId = accounts.addressIdMap[_liquidator];
    if (accountId.isNull()) {
      revert AccountDoesNotExist(_liquidator);
    }
    
    accounts.idNodeMap[accountId].liquidator = false;
  }




  function createAccount(uint256 _amount) public returns (AccountIdType accountId) {
    if (_amount < minAccountOpen) {
      revert InsufficentAmountToOpenAccount(msg.sender, _amount);
    }

    accountId = accounts.addressIdMap[msg.sender];
    if (!accountId.isNull()) {
      revert AccountExists(msg.sender, accountId);
    }

    accountId = accounts.nextAccountId;
    accounts.idNodeMap[accountId] = Account(INIT_MARGIN, 0, false, 0, 0, 0, 0);
    accounts.addressIdMap[msg.sender] = accountId;
    
    accounts.nextAccountId = accounts.nextAccountId.inc();
    if (accounts.nextAccountId.isFirst()) {
      revert NoAccountsRemain();
    }

    depositCollateral(_amount);
  }

  function depositCollateral(uint256 _amount) public {
    AccountIdType accountId = accounts.addressIdMap[msg.sender];
    if (accountId.isNull()) {
      revert AccountDoesNotExist(msg.sender);
    }


    IERC20Metadata(collateralToken).safeTransferFrom(msg.sender, address(this), _amount);

    accounts.idNodeMap[accountId].balance += uint112(_amount);

  }

  function withdrawCollateral(uint256 _amount) public {
    AccountIdType accountId = accounts.addressIdMap[msg.sender];
    if (accountId.isNull()) {
      revert AccountDoesNotExist(msg.sender);
    }

    uint256 collateralBalance = accounts.idNodeMap[accountId].balance;
    if (_amount > collateralBalance) {
      revert WithdrawAmountExceedsBalance(_amount, collateralBalance);
    }


    IERC20Metadata(collateralToken).safeTransferFrom(address(this), msg.sender, _amount);

    accounts.idNodeMap[accountId].balance -= uint112(_amount);

  }

  function order(
    PerpContractIdType _id,
    OrderEnum _orderType,
    PriceTypeFP _price,     
    LotTypeFP _lot,
    uint32 _tif,
    bool _postOnly,
    bool _fillOrKill,
    bool _ignoreRemainder,
    uint256 _maxMatches         
  ) internal returns (
    OrderResult memory result 
  ) {
    
    AccountIdType accountId = accounts.addressIdMap[msg.sender];
    if (accountId.isNull()) {
      revert AccountDoesNotExist(msg.sender);
    }

    PerpContract storage perp = contracts.map[_id];
    
    if (!existsPerpContract(perp)) {
      revert ContractDoesNotExist(_id);
    }

    if (perp.paused) {
      revert ContractIsPaused(_id);
    }

    result = perp.issueOrder(
      accounts,
      accountId,
      _orderType,
      _price,
      _lot,
      _tif,
      _postOnly,
      _fillOrKill,
      _ignoreRemainder,
      _maxMatches
    );

    if (result.matchCount > 0) {
      dumpMatches(result);


      uint256 sumPriceLotProd;
      uint256 sumLot;

      for (uint256 matchIndex = 0; matchIndex < result.matchCount; matchIndex++) {
        Order memory matchOrder = result.matches[matchIndex];
        settleOrder(perp, matchOrder, true);

        sumPriceLotProd += matchOrder.price.toUint256() * matchOrder.lot.toUint256();
        sumLot += matchOrder.lot.toUint256();
      }

      PriceTypeFP effectivePrice = PriceLib.fromUint256(sumPriceLotProd / sumLot);

      
      Order memory filledOrder = Order( accountId,
                                        _orderType,
                                        effectivePrice,
                                        _lot,
                                        _tif,
                                        OrderIdLib.NULL,
                                        OrderIdLib.NULL,
                                        OrderIdLib.NULL);
      settleOrder(perp, filledOrder, false);
     
      dumpPositions(perp.positions);

      dumpAccounts(accounts, contracts);

      console.log("Vault\n- - - - - - - - - - - - - - - - - - - - ");
      console.log("\n    balance = %d", balance);
      console.log("");
    }

    emit OrderPlaced(msg.sender, _id.toUint256(), result.signature.toUint256());
  }

  function marketOrder(PerpContractIdType _id,
                      OrderEnum _orderType,
                      LotTypeFP _lot) public {
    order(
      _id,
      _orderType,
      PriceLib.UNDEF_PRICE,
      _lot,
      NO_TIF,
      false,
      false,
      false,
      5
    );
  }


  function limitOrder(PerpContractIdType _id,
                      OrderEnum _orderType,
                      PriceTypeFP _price,
                      LotTypeFP _lot,           
                      uint32 _tif) public returns (OrderSignatureType os) {
    OrderResult memory result = order(
      _id,
      _orderType,
      _price,
      _lot,
      _tif,
      false,
      false,
      false,
      5
    );

    os = result.signature;
  }

  function increaseMargin(PerpContractIdType _perpId, uint256 _amount)
           internal
  {
    AccountIdType accountId = accounts.addressIdMap[msg.sender];
    if (accountId.isNull()) {
      revert AccountDoesNotExist(msg.sender);
    }
    
    PerpContract storage perp = contracts.map[_perpId];
    if (!existsPerpContract(perp)) {
      revert ContractDoesNotExist(_perpId);
    }
    
    Position storage position = perp.positions.idNodeMap[accountId];
    if (position.deposit == 0) {
      revert PositionDoesNotExist(accountId, _perpId);
    }

    Account storage account = accounts.idNodeMap[accountId];
    if (account.balance < _amount) {
      revert InsufficientFundsForOperation(account.balance, _amount);
    }

    account.balance -= uint112(_amount);
    position.deposit += uint112(_amount);
    perp.balance += uint112(_amount);

  }
  
  function decreaseMargin(PerpContractIdType _perpId, uint256 _amount)
           internal
  {
    AccountIdType accountId = accounts.addressIdMap[msg.sender];
    if (accountId.isNull()) {
      revert AccountDoesNotExist(msg.sender);
    }
    
    PerpContract storage perp = contracts.map[_perpId];
    if (!existsPerpContract(perp)) {
      revert ContractDoesNotExist(_perpId);
    }
    
    Position storage position = perp.positions.idNodeMap[accountId];
    if (position.deposit == 0) {
      revert PositionDoesNotExist(accountId, _perpId);
    }
    
    Account storage account = accounts.idNodeMap[accountId];

    (int112 positionPNL, int112 groupPNL) = getPositionPNL(perp, position, LotLib.NULL_LOT);

    position.deposit -= uint112(_amount);
    perp.balance -= uint112(_amount);
    account.balance += uint112(_amount);
  }



  function calculateAveragePrice(PriceTypeFP _price1,
                                 LotTypeFP _lot1,
                                 PriceTypeFP _price2,
                                 LotTypeFP _lot2)
           internal pure
           returns (PriceTypeFP averagePrice)
  {
    uint256 lot1 = _lot1.toUint256();
    uint256 lot2 = _lot2.toUint256();

    averagePrice = PriceLib.fromUint256(
      ((_price1.toUint256() * lot1) + (_price2.toUint256() * lot2)) / (lot1 + lot2)
    );
  }

  function calculateDeposit(uint24 _leverage, PriceTypeFP _price, LotTypeFP _lot)
           internal pure
           returns (uint112 deposit)
  {
    deposit = uint112( (_price.toUint256() * _lot.toUint256()) / uint256(_leverage) );
  }

  function calculateMakerFee(uint112 _deposit)
           internal pure
           returns (uint112 makerFee)
  {
    makerFee = (_deposit * MAKER_FEE) / PCT_DENOMINATOR;
  }
  
  function calculateTakerFee(uint112 _deposit)
           internal pure
           returns (uint112 takerFee)
  {
    takerFee = (_deposit * TAKER_FEE) / PCT_DENOMINATOR;
  }

  function calculateMMR(PriceTypeFP _currentPrice, LotTypeFP _lot, uint256 invMMF)
           internal pure
           returns (uint112 marginRequired)
  {
    marginRequired = uint112( (_currentPrice.toUint256() * _lot.toUint256()) / invMMF );
  }

  function getPositionPNL(PerpContract storage _perp,
                          Position storage _position,
                          LotTypeFP _lot) internal returns (int112 positionPNL, int112 groupPNL)
  {
    return (0, 0);
  }

  function settleOrder(PerpContract storage _perp,
                       Order memory _order,
                       bool isMakerFee) internal
  {
    Position storage position = _perp.positions.idNodeMap[_order.accountId];
    if (position.deposit == 0) {
      newPosition(_perp, _order, isMakerFee);
    } else {
      console.log("WARNING: Merging order for matched taker order on account %d",
                  _order.accountId.toUint256());

      if ( (
             (position.positionType == PositionEnum.Long) &&
             (_order.orderType == OrderEnum.OpenLong ||
              _order.orderType == OrderEnum.CloseShort)
           ) || (
             (position.positionType == PositionEnum.Short) &&
             (_order.orderType == OrderEnum.OpenShort ||
              _order.orderType == OrderEnum.CloseLong)
           ) )
      {
        increasePosition(_perp, position, _order, isMakerFee);
      } else {
        if (position.lot.gt(_order.lot)) {
          decreasePosition(_perp, position, _order, isMakerFee);
        } else if (position.lot.eq(_order.lot)) {
          closePosition(_perp, position, _order, isMakerFee);
        } else {
          invertPosition(_perp, position, _order, isMakerFee);
        }
      }
    }
  }

  function newPosition(PerpContract storage _perp,
                       Order memory _matchOrder,
                       bool isMakerFee) internal
  {
    if (_matchOrder.orderType == OrderEnum.CloseLong || _matchOrder.orderType == OrderEnum.CloseShort) {
      revert PositionDoesNotExist(_matchOrder.accountId, _perp.id);
    }
    
    Account storage account = accounts.idNodeMap[_matchOrder.accountId];
    uint112 deposit = calculateDeposit(account.leverage, _matchOrder.price, _matchOrder.lot);
    uint112 fee = (isMakerFee) ? calculateMakerFee(deposit) : calculateTakerFee(deposit);
    

    PositionEnum positionType =
      (_matchOrder.orderType == OrderEnum.OpenLong) ? PositionEnum.Long : PositionEnum.Short;
    _perp.positions.append(_matchOrder.accountId,
                           Position( AccountIdLib.NULL,
                                     AccountIdLib.NULL,
                                     positionType,
                                     deposit,
                                     _matchOrder.price,
                                     _matchOrder.lot,
                                     uint32(block.timestamp))
                         );

    if (positionType == PositionEnum.Long) {
      _perp.openInterest += _matchOrder.lot.toUint256();
    }
    
    account.balance -= deposit;
    _perp.balance += deposit;

    account.balance -= fee;
    balance += fee;

    setAccountPositionIndicator(account, _perp.id);
  }

  function increasePosition(PerpContract storage _perp,
                            Position storage _position,
                            Order memory _matchOrder,
                            bool isMakerFee) internal
  {

    Account storage account = accounts.idNodeMap[_matchOrder.accountId];
    uint112 additionalDeposit = calculateDeposit(account.leverage, _matchOrder.price, _matchOrder.lot);
    uint112 fee = (isMakerFee) ? calculateMakerFee(additionalDeposit) : calculateTakerFee(additionalDeposit);

    PriceTypeFP avgPrice =
      calculateAveragePrice(_matchOrder.price, _matchOrder.lot, _position.price, _position.lot);

    _position.price = avgPrice;
    _position.lot = _position.lot.add(_matchOrder.lot);
    _position.deposit += additionalDeposit;

    account.balance -= additionalDeposit;
    _perp.balance += additionalDeposit;

    if (_position.positionType == PositionEnum.Long) {
      _perp.openInterest += _matchOrder.lot.toUint256();
    }

    account.balance -= fee;
    balance += fee;
  }

  function decreasePosition(PerpContract storage _perp,
                                Position storage _position,
                                Order memory _matchOrder,
                                bool isMakerFee) internal
  {
    uint112 depositAffected = uint112(
      (_matchOrder.lot.toUint256() * _position.deposit) / _position.lot.toUint256()
    ); 

    (int112 positionPNL, ) = getPositionPNL(_perp, _position, _matchOrder.lot);
    uint112 withdrawGross;
    if (positionPNL >= 0) {
      withdrawGross = depositAffected + uint112(positionPNL);
    } else {
      uint112 loss = uint112(-positionPNL);
      if (loss <= depositAffected) {
        withdrawGross = depositAffected - loss;
      } else {
        withdrawGross = 0;
      }
    }
    
    uint112 fee = (isMakerFee) ? calculateMakerFee(withdrawGross) : calculateTakerFee(withdrawGross);
    uint112 withdrawNet;
    if (withdrawGross >= fee) {
      withdrawNet = withdrawGross - fee;
    } else {
      fee = withdrawGross;     
    }

    _position.lot = _position.lot.sub(_matchOrder.lot);
    _position.deposit -= depositAffected;

    Account storage account = accounts.idNodeMap[_matchOrder.accountId];
    account.balance += withdrawNet;
    _perp.balance -= withdrawGross;
    
    if (_position.positionType == PositionEnum.Long) {
      _perp.openInterest -= _matchOrder.lot.toUint256();
    }

    balance += fee;
  }

  function closePosition(PerpContract storage _perp,
                         Position storage _position,
                         Order memory _matchOrder,
                         bool isMakerFee) internal
  {
    (int112 positionPNL, ) = getPositionPNL(_perp, _position, _matchOrder.lot);
    uint112 withdrawGross;
    if (positionPNL >= 0) {
      withdrawGross = _position.deposit + uint112(positionPNL);
    } else {
      uint112 loss = uint112(-positionPNL);
      if (loss <= _position.deposit) {
        withdrawGross = _position.deposit - loss;
      } else {
        withdrawGross = 0;
      }
    }

    uint112 fee = (isMakerFee) ? calculateMakerFee(withdrawGross) : calculateTakerFee(withdrawGross);
    uint112 withdrawNet;
    if (withdrawGross >= fee) {
      withdrawNet = withdrawGross - fee;
    } else {
      fee = withdrawGross;     
    }

    _perp.positions.remove(_matchOrder.accountId);

    Account storage account = accounts.idNodeMap[_matchOrder.accountId];
    clearAccountPositionIndicator(account, _perp.id);

    account.balance += withdrawNet;
    _perp.balance -= withdrawGross;
    
    if (_position.positionType == PositionEnum.Long) {
      _perp.openInterest -= _matchOrder.lot.toUint256();
    }

    balance += fee;
  }

  function invertPosition(PerpContract storage _perp,
                          Position storage _position,
                          Order memory _matchOrder,
                          bool isMakerFee) internal
  {
    LotTypeFP amountToOpenInversePosition = _matchOrder.lot.sub(_position.lot);
    _matchOrder.lot = _position.lot;

    decreasePosition(_perp, _position, _matchOrder, isMakerFee);

    _position.positionType =
      (_position.positionType == PositionEnum.Long) ? PositionEnum.Short : PositionEnum.Long;
    _matchOrder.lot = amountToOpenInversePosition;
    increasePosition(_perp, _position, _matchOrder, isMakerFee);
  }

  function setAccountPositionIndicator(Account storage _account, PerpContractIdType _id) internal
  {
    uint256 id = _id.toUint256();

    if (id <= 59) {
      _account.positionIndicator |= (1 << id);
    } else {
      uint256 bankBitShift;
      if (id <= 315) {
        bankBitShift = 59;
        _account.positions60Plus |= (1 << (id - 60));
      } else if (id <= 571) {
        bankBitShift = 60;
        _account.positions316Plus |= (1 << (id - 316));
      } else if (id <= 818) {
        bankBitShift = 61;
        _account.positions572Plus |= (1 << (id - 572));
      } 
      
      _account.positionIndicator |= (1 << bankBitShift);
    }
  }
  
  function clearAccountPositionIndicator(Account storage _account, PerpContractIdType _id) internal
  {
    uint256 id = _id.toUint256();

    if (id <= 59) {
      _account.positionIndicator &= ~(1 << id);
    } else {
      uint256 bankBitShift;
      if (id <= 315) {
        _account.positions60Plus &= ~(1 << (id - 60));
        if (_account.positions60Plus == 0) {
          bankBitShift = 59;
        }
      } else if (id <= 571) {
        _account.positions316Plus &= ~(1 << (id - 316));
        if (_account.positions316Plus == 0) {
          bankBitShift = 60;
        }
      } else if (id <= 818) {
        _account.positions572Plus &= ~(1 << (id - 572));
        if (_account.positions572Plus == 0) {
          bankBitShift = 61;
        }
      } 
      
      if (bankBitShift > 0) {
        _account.positionIndicator |= ~(1 << bankBitShift);
      }
    }
  }



  function cancelOrder(PerpContractIdType _id, OrderSignatureType _signature) public {
    PerpContract storage perp = contracts.map[_id];
    
    if (!existsPerpContract(perp)) {
      revert ContractDoesNotExist(_id);
    }
    
    FQClob storage clob = perp.clob;
    clob.cancelOrder(_signature);
  }

  function multicall() public {
  }
  

  function getAccounts() public view {
  }

  function getPNL(AccountIdType _accountId) public {
  }

  function liquidate(AccountIdType _accountId) public {
  }


  function existsPerpContract(PerpContract storage perp) internal view returns (bool) {
    return !(perp.indexFP == 0 &&
             perp.markFP == 0 &&
             perp.openInterest == 0 &&
             perp.admin == NULL_ADDR);
  }
}
