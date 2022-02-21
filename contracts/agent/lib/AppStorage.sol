// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import '../../nft/interfaces/IERC1155Rewardable.sol';

struct BillingStatement {
    uint balance;  // Today's total locked (not liquidated) NFT for today
    uint surplus;  // Today's surplus (mined target tokens - the part to payoff unpaid cost) in incomeToken
    uint debt;  // The debt in paymentToken if today's mined target tokens cannot pay off cost
}

struct AppStorage {
    uint tokenCost; // cost per nft in payment token

    IERC1155Rewardable nft; // DeMineNFT contract address
    address incomeToken; // The target token to be mined (e.g. BTC)
    address paymentToken; // The type of token to pay off cost (e.g. USDT)
    address custodian; // payee account address, could be contract
    mapping(uint => mapping(address => uint)) balances;  // owner => buyer => allowance

    // billing related
    mapping(uint256 => BillingStatement) statements; // Billing statement for each NFT token.
    AggregatorV3Interface chainlink;
    address swapRouter;
    uint16 earningTokenSaleDiscount10000Based; // 10000 based
    mapping(uint => uint) lockedUntil; // earning token sale

    // primary market sale related
    mapping(address => bool) supportedPricingStrategies;
    mapping(address => address) pricingStategy;

    mapping(address => bool) supportedAllowanceStrategies;
    mapping(address => address) allowanceStrategy;
}

abstract contract StorageBase {
    AppStorage internal s;
}
