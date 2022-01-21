// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/token/ERC20/ERC20.sol';
import '@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol';

import './lib/Cloneable.sol';
import './lib/LibPausable.sol';
import './lib/LibInitializable.sol';

contract WrappedToken is
    Cloneable,
    Pausable,
    Initializable,
    SafeOwnable,
    ERC20
{
    using OwnableStorage for OwnableStorage.Layout;

    function initialize(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public initializer {
        OwnableStorage.layout().setOwner(msg.sender);
        ERC20MetadataStorage.Layout storage l = ERC20MetadataStorage.layout();
        l.name = name;
        l.symbol = symbol;
        l.decimals = decimals;
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
