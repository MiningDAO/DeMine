// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

struct Mortgage {
    address owner;
    uint start;
    uint end;
    uint supply;
    uint initialDeposit;
}

struct TokenInfo {
    uint income; // per token
    uint supply;
    // after billing
    uint adjust; // per token
    uint debt; // per token
}

struct AppStorage {
    ERC1155WithAgentFacet nft;

    uint8 minDepositDaysRequired;
    IERC20 cost;
    IERC20 income;
    uint tokenCost; // USD

    uint minining; // mining token
    uint billing; // billing token
    uint shrinked; // shrinking token
    uint8 shrinkSize; // num of tokens we shrink starting from next rewarding token

    // mortgage
    uint mortgage;
    mapping(uint => Mortgage) mortgages;

    mapping(uint => TokenInfo) info;

    // tokenId => account => price
    mapping(uint => mapping(address => uint)) balances;
    // owner => buyer => allowance
    mapping(address => mapping(address => mapping(uint => uint))) allowances;
}
