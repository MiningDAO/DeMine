// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import '../../nft/interfaces/IERC1155Rewardable.sol';

struct Account {
    uint start; // starting from 2**256 - 1 - start
    uint end;
    uint maxBalance;
}

struct Statement {
    uint balance;
    uint income;
    uint debt;
}

struct AppStorage {
    uint tokenCost; // cost per nft in cost token

    IERC20 income;
    IERC20 payment;
    IERC1155Rewardable nft; // DeMineNFT contract address
    address payee; // payee account address, could be contract

    bool initialized;
    uint8 depositMultiplier; // deposit = maxBalance * tokenCost * depositMultiplier
    uint deposit; // total deposit in cost token
    uint billing; // current billing token
    // billing statement
    mapping(uint => Statement) statements;
    // account info
    mapping(address => Account) accounts;
    // tokenId => account => price
    mapping(uint => mapping(address => uint)) balances;
    // owner => buyer => allowance
    mapping(address => mapping(address => mapping(uint => uint))) allowances;
}
