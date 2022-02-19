// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import '../../nft/interfaces/IERC1155Rewardable.sol';

struct BillingStatement {
    uint balance;  // Today's total locked (not liquidated) NFT for today
    uint surplus;  // Today's surplus (mined target tokens - the part to payoff unpaid cost) in incomeToken
    uint debt;  // The debt in paymentToken if today's mined target tokens cannot pay off cost
}

struct AppStorage {
    uint tokenCost; // cost per nft in payment token

    IERC20 incomeToken; // The target token to be mined (e.g. BTC) 
    IERC20 paymentToken; // The type of token to pay off cost (e.g. USDT) 
    IERC1155Rewardable nft; // DeMineNFT contract address
    address payee; // payee account address, could be contract

    bool initialized;
    uint128 billedTime; // The end timestamp of the last day being billed
    mapping(uint256 => BillingStatement) statements; // Billing statement for each NFT token.
                                                     // mapping(end_timestamp => BillingStatement)

    mapping(uint => mapping(address => uint)) balances;  // owner => buyer => allowance
    mapping(address => mapping(address => mapping(uint => uint))) allowances;
}
