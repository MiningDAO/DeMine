// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/DiamondFallback.sol';
import '../../shared/lib/LibPausable.sol';
import './MiningOracle.sol';
import './ERC1155Config.sol';

contract ERC1155Facet is
    DiamondFallback,
    ERC1155Base,
    MiningOracle,
    ERC1155Config,
    ERC165
{
    using SafeERC20 for IERC20;

    event Alchemy(address indexed account, uint totalEarning);

    function init(bytes memory args) internal override onlyInitializing {
        (
            address recipient,
            uint16 bps,
            address earningTokenAdd,
            string memory uri
        ) = abi.decode(args, (address, uint16, address, string));
        s.royalty = RoyaltyInfo(recipient, bps);
        s.earningToken = IERC20(earningTokenAdd);
        _setBaseURI(uri);
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

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint[] memory ids,
        uint[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155BaseInternal) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        address alchemist = _alchemist();
        require(from != alchemist, 'DeMineNFT: from alchemist');
        // alchemize
        if (to == alchemist) {
            require(!LibPausable.layout().paused, 'Pausable: paused');
            uint totalEarning;
            uint finalized = s.finalized;
            for (uint i; i < ids.length; i++) {
                (uint128 start, uint128 end) = decode(ids[i]);
                require(end <= finalized, 'DeMineNFT: token not finalized yet');
                totalEarning += amounts[i] * _earning(start, end);
            }
            s.earningToken.safeTransfer(from, totalEarning);
            emit Alchemy(from, totalEarning);
        }
    }

    function decode(uint tokenId) private pure returns(uint128, uint128) {
        return (uint128(tokenId >> 128), uint128(tokenId));
    }
}
