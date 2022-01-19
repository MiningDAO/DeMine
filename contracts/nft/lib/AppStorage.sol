// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

struct Token {
    uint supply;
    uint income;
}

struct AppStorage {
    mapping(address => bool) agents;
    // mining
    IERC20 income;
    uint mining;
    mapping(uint => Token) tokens;
}
