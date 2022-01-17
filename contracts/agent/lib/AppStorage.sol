// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import '../../nft/interfaces/IDeMineNFT.sol';

struct Mortgage {
    address owner;
    uint128 start;
    uint128 end;
    uint supply;
    uint deposit;
}

struct Cycle {
    uint adjust; // per token
    uint debt; // per token
}

struct AppStorage {
    IERC20 cost;
    IERC20 income;
    address nft;

    uint tokenCost; // cost token
    uint deposit; // cost token

    uint128 billing; // billing token
    uint128 shrinked; // shrinking token
    uint8 shrinkSize; // num of tokens we shrink starting from next rewarding token
    uint8 minDepositDaysRequired;
    uint128 mortgageId;
    mapping(uint128 => Mortgage) mortgages;
    mapping(uint128 => Cycles) cycles;

    // tokenId => account => price
    mapping(uint => mapping(address => uint)) balances;
    // owner => buyer => allowance
    mapping(address => mapping(address => mapping(uint => uint))) allowances;
}
