// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/token/ERC20/ERC20.sol';
import '@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol';
import '@solidstate/contracts/factory/CloneFactory.sol';

import './lib/LibPausable.sol';
import './lib/LibInitializable.sol';

contract DeMineERC20 is
    CloneFactory,
    Pausable,
    Initializable,
    SafeOwnable,
    ERC20
{
    event Clone(address indexed from, address indexed cloned);

    using OwnableStorage for OwnableStorage.Layout;

    function initialize(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address owner
    ) external initializer {
        OwnableStorage.layout().setOwner(owner);
        ERC20MetadataStorage.Layout storage l = ERC20MetadataStorage.layout();
        l.name = name;
        l.symbol = symbol;
        l.decimals = decimals;
    }

    function create(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address owner
    ) external {
        address payable cloned = payable(_deployClone());
        emit Clone(address(this), cloned);
        DeMineERC20(cloned).initialize(name, symbol, decimals, owner);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
