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
    address paymentToken; // The type of token to pay off cost (e.g. USDT)
    address custodian; // payee account address, could be contract
    uint16 royaltyBps;  // royalty bps, 10000 based
    uint royaltyCap;  // max royalty value to accept

    mapping(uint => mapping(address => uint)) balances;  // owner => buyer => allowance

    // billing related
    mapping(uint256 => BillingStatement) statements; // Billing statement for each NFT token.
    AggregatorV3Interface chainlink;
    address swapRouter;
    uint16 earningTokenSaleDiscount10000Based; // 10000 based

    // primary market sale related
    // 0: unregistered, 1: pricing strategy, 2: allowance strategy
    mapping(address => uint8) strategyRegistry;
    mapping(address => mapping(uint8 => address)) strategies;
}

abstract contract StorageBase {
    AppStorage internal s;
}
