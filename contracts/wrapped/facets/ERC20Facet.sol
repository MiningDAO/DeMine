// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC20/ERC20.sol';

contract ERC20Facet is ERC20, OwnableInternal {
    function burn(uint256 amount) external onlyOwner {
        _burn(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
