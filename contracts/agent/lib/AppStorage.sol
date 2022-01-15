// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

struct Mortgage {
    address owner;
    uint start;
    uint end;
    uint supply;
    uint initialDeposit;
}

struct TokenInfo {
    uint reward; // per token
    uint supply;
    // after billing
    uint adjustedReward; // per token
    uint depositDebt; // per token
}

struct AppStorage {
    ERC1155WithAgentFacet nft;

    uint8 minDepositDaysRequired;
    address cost;
    address reward;
    uint tokenCost;

    // mortgage
    uint nextMortgage;
    mapping(uint => Mortgage) mortgages;

    // rewarding
    uint rewardingCycle;
    mapping(uint => TokenInfo) info;

    // tokenId => account => price
    mapping(uint => mapping(address => uint)) balances;
    // owner => buyer => allowance
    mapping(address => mapping(address => mapping(uint => uint))) allowances;
}
