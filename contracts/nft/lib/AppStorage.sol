// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

struct Token {
    uint supply;
    uint income;
}

struct AppStorage {
    IERC20 income;
    uint mining;
    mapping(uint => Token) tokens;
}
