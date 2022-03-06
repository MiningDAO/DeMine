// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestEarningToken is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        address to,
        uint256 amount
    ) ERC20(name, symbol) {
        _mint(to, amount);
    }
}
