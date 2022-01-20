// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

struct Token {
    uint supply;
    uint income;
}

struct RoyaltyInfo {
    address recipient;
    uint16 bps;
}

struct AppStorage {
    IERC20 income;
    uint mining;
    mapping(uint => Token) tokens;
    RoyaltyInfo royalty;
}
