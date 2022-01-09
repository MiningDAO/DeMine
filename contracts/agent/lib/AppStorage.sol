// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

struct Pool {
    address owner;
    uint256 tokenCost;
    uint256 tokenPrice;
}

struct Cycle {
    uint256 supply;
    uint256 reward; // per token
}

struct AppStorage {
    uint128 nextPool;
    uint128 lastRewardedCycle;

    address nft;
    address reward;

    mapping(uint128 => Pool) pools;
    mapping(uint128 => Cycle) cycles;
    mapping(uint256 => uint256) prices;
    mapping(uint256 => mapping(address => uint256)) allowances;
}
