// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

struct Pool {
    // cashed out reward for billing
    uint128 lastBillingCycle;
    uint256 totalCashedout;
    uint256 locked;
}

struct Cycle {
    uint256 reward; // per token
    uint256 supply;
    EnumerableSet.UintSet pools;
}

struct AppStorage {
    address nft;
    uint256 tokenCost;
    uint256 tokenPrice;
    uint128 nextPool;
    address rewardToken;
    uint128 rewardingCycle;
    mapping(uint128 => Pool) pools;
    mapping(uint128 => Cycle) cycles;
    // tokenId => price
    mapping(uint256 => uint256) prices;
    // tokenId => allowedBuyer => allowance
    mapping(uint256 => mapping(address => uint256)) allowances;
    // cycle => pool => balance
    mapping(uint128 => mapping(uint128 => uint256)) balances;
}
