// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155Metadata.sol';

import '../../shared/lib/LibPausable.sol';
import '../interfaces/IERC2981.sol';
import '../lib/AppStorage.sol';

contract ERC1155Facet is
    IERC2981,
    OwnableInternal,
    PausableModifier,
    ERC1155Base,
    ERC1155Metadata,
    ERC165
{
    AppStorage internal s;
    event TokenRoyaltyBpsSet(uint16);

    function setBaseURI(string memory baseURI) external onlyOwner {
        _setBaseURI(baseURI);
    }

    function setTokenURI(
        uint256 tokenId,
        string memory baseURI
    ) external onlyOwner {
        _setTokenURI(tokenId, baseURI);
    }

    function setRoyaltyInfo(address recipient, uint16 bps) external onlyOwner {
        s.royalty = RoyaltyInfo(recipient, bps);
        emit TokenRoyaltyBpsSet(bps);
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address, uint256)
    {
        RoyaltyInfo memory r = s.royalty;
        return (r.recipient, (value * r.bps) / 10000);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint[] memory ids,
        uint[] memory amounts,
        bytes memory data
    ) internal whenNotPaused virtual override(ERC1155BaseInternal) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
