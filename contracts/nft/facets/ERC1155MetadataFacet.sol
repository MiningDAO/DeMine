// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155Metadata.sol';

contract ERC1155MetadataFacet is ERC1155Metadata, OwnableInternal {
    function setBaseURI(string memory baseURI) external onlyOwner {
        _setBaseURI(baseURI);
    }

    function setTokenURI(
        uint256 tokenId,
        string memory baseURI
    ) external onlyOwner {
        _setTokenURI(tokenId, baseURI);
    }
}
