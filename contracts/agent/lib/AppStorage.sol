// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

struct Cycle {
    uint256 reward; // per token
    uint256 supply;
}

struct AppStorage {
    // metadata
    address nft;
    uint256 tokenCost;
    address rewardToken;

    // rewarding
    uint256 rewardingCycle;
    mapping(uint256 => Cycle) cycles;

    // billing
    uint256 lastBillingCycle;
    uint256 totalCashedout;
    uint256 lockedCashedout;

    // tokenId => account => price
    mapping(uint256 => mapping(address => uint256)) balances;
    // owner => buyer => allowance
    mapping(address => mapping(address => uint256)) allowances;

    // payments
    address custodian;
    EnumerableSet.AddressSet payments;
}
