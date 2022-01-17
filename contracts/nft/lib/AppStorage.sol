// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

struct Cycle {
    uint supply;
    uint income;
}

struct Layout {
    // pool/agent registration
    mapping(address => uint128) pools;
    mapping(uint128 => address) agents;

    // mining
    IERC20 income;
    uint128 mining;
    mapping(uint128 => Cycle) cycles;
}
