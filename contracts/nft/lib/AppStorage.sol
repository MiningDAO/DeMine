// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

struct Token {
    uint supply;
    uint reward;
}

struct RoyaltyInfo {
    address recipient;
    uint16 bps;
}

struct AppStorage {
    IERC20 reward;
    uint mining;
    address alchemist;
    RoyaltyInfo royalty;
    mapping(uint => Token) tokens;
}
