// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/introspection/ERC165.sol';

import '../interfaces/IERC2981.sol';
import '../lib/LibERC2981.sol';

contract ERC2981Facet is
    OwnableInternal,
    IERC2981,
    ERC165
{
    event TokenRoyaltyBpsSet(uint16);

    function setRoyaltyInfo(address recipient, uint16 bps) external onlyOwner {
        LibERC2981.layout().recipient = recipient;
        LibERC2981.layout().bps = bps;
        emit TokenRoyaltyBpsSet(bps);
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address, uint256)
    {
        uint16 bps = LibERC2981.layout().bps;
        address recipient = LibERC2981.layout().recipient;
        return (recipient, (value * bps) / 10000);
    }
}
