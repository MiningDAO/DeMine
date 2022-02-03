// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

struct RoyaltyInfo {
    address recipient;
    uint16 bps;
}

struct AppStorage {
    IERC20 earningToken;
    RoyaltyInfo royalty;
    mapping(uint => uint) supply;

    // Oracle
    uint128 finalized;
    mapping(uint128 => uint) daily;
    mapping(uint128 => uint) weekly;
}
