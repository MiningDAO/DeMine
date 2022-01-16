// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';

import '../../shared/lib/LibPausable.sol';
import '../../agent/facets/PaycheckFacet.sol';
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

    event Alchemy(
        address indexed operator,
        address indexed account,
        uint256[] ids,
        uint256[] amounts
    );

    function mintBatch(
        address recipient,
        uint256[] memory ids,
        uint256[] memory supplies
    ) external onlyAgent {
        _safeMintBatch(recipient, ids, supplies, "");
    }

    function burn(
        uint256 tokenId
    ) external onlyAgent returns(uint256 balance) {
        balance = _balanceOf(msg.sender, tokenId);
        _burn(msg.sender, tokenId, balance);
    }

    function alchemize(
        address account,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external {
        require(
            msg.sender == account || isApprovedForAll(account, msg.sender),
            'DeMineNFT: operator is not caller or approved'
        );
        _burnBatch(account, ids, amounts);
        PaycheckFacet(
            LibERC1155WithAgent.layout().agent
        ).cashout(account, ids, amounts);
        emit Alchemy(msg.sender, account, ids, amounts);
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
