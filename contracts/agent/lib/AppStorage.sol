// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

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
    IERC20 cost;
    IERC20 income;
    address nft;

    uint8 depositMultiplier; // deposit = maxBalance * tokenCost * depositMultiplier
    uint tokenCost; // cost per nft in cost token
    uint deposit; // total deposit in cost token

    uint billing; // billing token
    mapping(uint => Statement) statements;
    mapping(address => Account) accounts;
    // tokenId => account => price
    mapping(uint => mapping(address => uint)) balances;
    // owner => buyer => allowance
    mapping(address => mapping(address => mapping(uint => uint))) allowances;
}
