// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import '../../nft/interfaces/IERC1155Rewardable.sol';

struct BillingStatement {
    uint balance;  // Today's total locked (not liquidated) NFT for today
    uint surplus;  // Today's surplus (mined target tokens - the part to payoff unpaid cost) in incomeToken
    uint debt;  // The debt in paymentToken if today's mined target tokens cannot pay off cost
    uint lockedUtil;
}

struct AppStorage {
    uint tokenCost; // cost per nft in payment token

    IERC1155Rewardable nft; // DeMineNFT contract address
    address incomeToken; // The target token to be mined (e.g. BTC)
    address paymentToken; // The type of token to pay off cost (e.g. USDT)
    address custodian; // payee account address, could be contract

    mapping(uint256 => BillingStatement) statements; // Billing statement for each NFT token.

    mapping(uint => mapping(address => uint)) balances;  // owner => buyer => allowance
    mapping(address => mapping(address => mapping(uint => uint))) allowances;

    // billing related
    AggregatorV3Interface chainlink;
    address swapRouter;
    uint16 earningTokenSaleDiscount10000Based; // 10000 based
    mapping(uint => uint) lockedUntil; // earning token sale
}
