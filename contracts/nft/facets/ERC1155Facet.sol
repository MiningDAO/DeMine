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
import '../../shared/lib/DiamondFallback.sol';
import '../interfaces/IERC2981.sol';
import '../interfaces/IERC1155Rewardable.sol';
import '../interfaces/IMiningOracle.sol';
import '../lib/AppStorage.sol';

contract ERC1155Facet is
    DiamondFallback,
    IERC1155Rewardable,
    IERC2981,
    OwnableInternal,
    ERC1155Base,
    ERC1155Metadata,
    ERC165
{
    AppStorage internal s;
    using SafeERC20 for IERC20;

    event TokenRoyaltyBpsSet(uint16);
    event Alchemy(address indexed account, uint earning);

    function init(bytes memory args) internal override onlyInitializing {
        (
            address recipient,
            uint16 bps,
            address earningTokenAdd,
            string memory uri
        ) = abi.decode(args, (address, uint16, address, string));
        s.royalty = RoyaltyInfo(recipient, bps);
        s.earningToken = IERC20(earningTokenAdd);
        s.finalized = IMiningOracle(address(this)).origin();
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

    function earningToken() external override view returns(address) {
        return address(s.earningToken);
    }

    function getAlchemist() external override pure returns(address) {
        return _alchemist();
    }

    function supplyOf(
        uint[] calldata ids
    ) external view returns(uint[] memory) {
        uint[] memory res = new uint[](ids.length);
        for (uint i; i < ids.length; i++) {
            res[i] = s.supply[ids[i]];
        }
        return res;
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
            uint earning;
            IMiningOracle oracle = IMiningOracle(address(this));
            uint finalized = oracle.finalized();
            for (uint i; i < ids.length; i++) {
                require(uint128(ids[i]) <= finalized, 'DeMineNFT: token not mined');
                earning += amounts[i] * oracle.earning(ids[i]);
            }
            s.earningToken.safeTransfer(from, earning);
            emit Alchemy(from, earning);
        }
        // burn
        if (to == address(0)) {
            uint128 today = beginOfDay(uint128(block.timestamp));
            for (uint i; i < ids.length; i++) {
                uint128 start = uint128(ids[i] >> 128);
                require(start > today, 'DeMineNFT: token mined or mining');
                s.supply[ids[i]] -= amounts[i];
            }
        }
        // mint
        if (from == address(0)) {
             uint128 today = beginOfDay(uint128(block.timestamp));
             for (uint i; i < ids.length; i++) {
                uint128 start = uint128(ids[i] >> 128);
                require(start > today, 'DeMineNFT: token mined or mining');
                s.supply[ids[i]] += amounts[i];
            }
        }
    }

    function _alchemist() private pure returns(address) {
        return address(0x1A811678eEEDF16a1D0dF4b12e290F78a61A28F9);
    }

    function beginOfDay(uint128 timestamp) private view returns(uint128) {
        uint128 origin = IMiningOracle(address(this)).origin();
        return timestamp - (timestamp - origin) % 86400; // daily
    }
}
