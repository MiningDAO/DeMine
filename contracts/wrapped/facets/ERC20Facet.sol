// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;
import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC20/ERC20.sol';
import '@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol';

import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/LibInitializable.sol';

contract ERC20Facet is
    Initializable,
    PausableModifier,
    OwnableInternal,
    ERC20
{
    function init(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) external onlyInitializing {
        ERC20MetadataStorage.Layout storage l = ERC20MetadataStorage.layout();
        l.name = name;
        l.symbol = symbol;
        l.decimals = decimals;
    }

    function burn(uint256 amount) external onlyOwner {
        _burn(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {}
}
