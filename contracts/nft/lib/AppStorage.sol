// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

struct RoyaltyInfo {
    address recipient;
    uint16 bps;
}

struct AppStorage {
    RoyaltyInfo royalty;
    address earningToken;

    // Oracle
    uint128 finalized;
    mapping(uint128 => uint) daily;
    mapping(uint128 => uint) weekly;

    // supply
    mapping(uint => uint) supply;
}
