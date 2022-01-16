// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';

import '../../shared/lib/LibPausable.sol';
import '../../agent/interfaces/IDeMineAgent.sol';
import '../interfaces/IDeMineNFT.sol';
import '../lib/LibERC1155WithAgent.sol';

contract ERC1155WithAgentFacet is
    IDeMineNFT,
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
        uint[] ids,
        uint[] amounts
    );

    function mintBatch(
        uint[] memory ids,
        uint[] memory supplies
    ) external override onlyAgent {
        _safeMintBatch(msg.sender, ids, supplies, "");
    }

    function burn(
        uint tokenId
    ) external override onlyAgent returns(uint balance) {
        balance = _balanceOf(msg.sender, tokenId);
        _burn(msg.sender, tokenId, balance);
    }

    function alchemize(
        address account,
        uint[] memory ids,
        uint[] memory amounts
    ) external {
        require(
            msg.sender == account || isApprovedForAll(account, msg.sender),
            'DeMineNFT: operator is not caller or approved'
        );
        _burnBatch(account, ids, amounts);
        address agent = LibERC1155WithAgent.layout().agent;
        IDeMineAgent(agent).cashout(account, ids, amounts);
        emit Alchemy(msg.sender, account, ids, amounts);
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
