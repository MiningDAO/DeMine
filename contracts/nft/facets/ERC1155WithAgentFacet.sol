// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';

import '../../shared/lib/LibPausable.sol';
import '../lib/LibERC1155WithAgent.sol';

contract ERC1155WithAgentFacet is
    ERC1155Base,
    PausableModifier,
    ERC165
{
    modifier onlyAgent() {
        require(
            msg.sender == LibERC1155WithAgent.layout().agent,
            'DeMineNFT: only DeMineAgent is allowed'
        );
        _;
    }

    function mintBatch(
        address recipient,
        uint256[] memory ids,
        uint256[] memory supplies
    ) external onlyAgent {
        _safeMintBatch(recipient, ids, supplies, "");
    }

    function burnBatch(
        address operator,
        address account,
        uint256[] memory ids,
        uint256[] memory supplies
    ) external onlyAgent {
        require(
            operator == account || isApprovedForAll(account, operator),
            'DeMineNFT: operator is not caller or approved'
        );
        _burnBatch(account, ids, supplies);
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
