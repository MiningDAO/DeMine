// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

struct RewardTokenLockedPrice {
    uint256 deposit;
    uint256 uintSize;
    uint256 uintPrice;
    uint expireAt;
}

struct Payment{
    bool supported;
    uint8 decimals;
}

struct TokenInfo {
    uint256 reward; // per token
    uint256 supply;
}

struct AppStorage {
    address nft;
    address uniswap;

    // chainlink data
    uint8 chainlinkDecimals;
    address chainlink;

    uint256 tokenCost;
    uint8 costTokenDecimals;
    uint256 defaultCostToken;
    address reward;
    uint8 rewardTokenDecimals;

    // rewarding
    uint256 rewardingCycle;
    mapping(uint256 => TokenInfo) info;

    // billing
    uint256 deposit;
    uint16 priceLockDuration; // as second
    uint8 billingDiscount; // 100 based
    uint8 minTryRequiredBeforeManualEnd;
    uint8 numAutoSwapTried;
    uint256 billingCycle;
    uint256 lockedReward;
    uint256 pendingCost;
    uint256 saleExpireAt;
    mapping(uint256 => uint256) soldReward;
    mapping(address => RewardTokenLockedPrice) lockedPrices;

    // tokenId => account => price
    mapping(uint256 => mapping(address => uint256)) balances;

    // owner => buyer => allowance
    mapping(address => mapping(address => uint256)) allowances;

    // payments
    address custodian;
    mapping(address => Payment)  payments;
}
