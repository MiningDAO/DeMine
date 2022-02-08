// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

struct RoyaltyInfo {
    address recipient;
    uint16 bps;
}

struct AppStorage {
    RoyaltyInfo royalty;
    address earningToken;
    uint256 status;

    // Oracle
    uint128 finalized;
    mapping(uint128 => uint) daily;
    mapping(uint128 => uint) weekly;

    // supply
    mapping(uint => uint) supply;
}
