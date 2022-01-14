// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

struct Mortgage {
    address owner;
    uint256 start;
    uint256 end;
    uint256 supply;
    uint256 initialDeposit;
}

struct TokenInfo {
    uint256 reward; // per token
    uint256 supply;
    // after billing
    uint256 adjustedReward; // per token
    uint256 depositDebt; // per token
}

struct AppStorage {
    ERC1155WithAgentFacet nft;

    uint8 minDepositDaysRequired;
    uint8 costTokenDecimals;
    uint8 rewardTokenDecimals;
    address cost;
    address reward;
    uint256 tokenCost;

    // mortgage
    uint256 nextMortgage;
    mapping(uint256 => Mortgage) mortgages;

    // rewarding
    uint256 rewardingCycle;
    mapping(uint256 => TokenInfo) info;

    // tokenId => account => price
    mapping(uint256 => mapping(address => uint256)) balances;
    // owner => buyer => allowance
    mapping(address => mapping(address => uint256)) allowances;
}
