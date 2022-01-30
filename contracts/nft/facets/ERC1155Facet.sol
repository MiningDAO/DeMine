// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155Metadata.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../interfaces/IERC2981.sol';
import '../interfaces/IERC1155Rewardable.sol';
import '../lib/AppStorage.sol';

contract ERC1155Facet is
    IERC1155Rewardable,
    IERC2981,
    OwnableInternal,
    PausableModifier,
    ERC1155Base,
    ERC1155Metadata,
    ERC165
{
    AppStorage internal s;
    using SafeERC20 for IERC20;

    event TokenRoyaltyBpsSet(uint16);
    event Alchemy(address indexed account, uint reward);
    event Finalize(uint indexed, uint);

    function finalize(uint reward) external onlyOwner {
        uint mining = s.mining;
        s.tokens[mining].reward = reward;
        s.mining = mining + 1;
        emit Finalize(mining, reward);
    }

    function mintBatch(
        address account,
        uint[] calldata ids,
        uint[] calldata amounts,
        bytes memory data
    ) external onlyOwner {
        _safeMintBatch(account, ids, amounts, data);
    }

    function burnBatch(
        uint[] calldata ids,
        uint[] calldata amounts
    ) external onlyOwner {
        _burnBatch(msg.sender, ids, amounts);
    }

    function setURI(string memory baseURI) external onlyOwner {
        _setBaseURI(baseURI);
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

    function getTokenInfo(
        uint[] calldata ids
    ) external view returns(Token[] memory) {
        Token[] memory res = new Token[](ids.length);
        for (uint i; i < ids.length; i++) {
            res[i] = s.tokens[ids[i]];
        }
        return res;
    }

    function getMiningToken() external view returns(uint) {
        return s.mining;
    }

    function getRewardToken() external override view returns(address) {
        return address(s.reward);
    }

    function getAlchemist() external override view returns(address) {
        return s.alchemist;
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
        address alchemist = s.alchemist;
        require(from != alchemist, 'DeMineNFT: from alchemist');
        // alchemize
        if (to == alchemist) {
            uint mining = s.mining;
            uint reward;
            for (uint i; i < ids.length; i++) {
                require(ids[i] < mining, 'DeMineNFT: not mined token');
                reward += amounts[i] * s.tokens[ids[i]].reward;
            }
            s.reward.safeTransfer(msg.sender, reward);
            emit Alchemy(msg.sender, reward);
        }
        // burn
        if (to == address(0)) {
            uint mining = s.mining;
            for (uint i; i < ids.length; i++) {
                require(ids[i] > mining, 'DeMineNFT: mined or mining token');
                s.tokens[ids[i]].supply -= amounts[i];
            }
        }
        // mint
        if (from == address(0)) {
             uint mining = s.mining;
             for (uint i; i < ids.length; i++) {
                require(ids[i] > mining, 'DeMineNFT: mined or mining token');
                s.tokens[ids[i]].supply += amounts[i];
            }
        }
    }
}
