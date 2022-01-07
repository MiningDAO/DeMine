// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155Metadata.sol';

import './utils/PausableInternal.sol';
import './ERC2981/ERC2981.sol';
import './DeMineNFTInternal.sol';

contract DeMineNFT is
    ERC1155Base,
    ERC1155Metadata,
    PausableInternal,
    DeMineNFTInternal,
    ERC2981,
    ERC165
{
    function cashout(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external whenNotPaused {
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "ERC1155: transfer caller is not owner nor approved"
        );
        _burnBatch(from, ids, amounts);
        _cashout(from, to, ids, amounts);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal whenNotPaused virtual override(ERC1155BaseInternal) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
