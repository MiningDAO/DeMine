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
import './ERC1155Config.sol';

contract ERC1155Facet is
    DiamondFallback,
    ERC1155Base,
    ERC1155Config,
    ERC165
{
    using SafeERC20 for IERC20;

    event Finalize(uint128 indexed, uint);
    event Alchemy(address indexed account, uint totalEarning);

    function init(bytes memory args) internal override {
        (address _earningToken) = abi.decode(args, (address));
        s.earningToken = _earningToken;
        s.royalty = RoyaltyInfo(custodian, 100);
    }

    constructor(address custodian) ERC1155Config(custodian) {}

    function mint(
        uint[] calldata ids,
        uint[] calldata amounts,
        bytes memory data
    ) external onlyOwner {
        _safeMintBatch(custodian, ids, amounts, data);
    }

    function finalize(
        uint128 endOfDay,
        uint earningPerTPerDay,
        uint effectiveHashratePerDay
    ) external onlyOwner {
        require(
            endOfDay > s.finalized && endOfDay % 86400 == 0,
            'DeMineNFT: invalid timestamp'
        );
        s.finalized = endOfDay;
        s.daily[endOfDay] = earningPerTPerDay;
        for(uint128 i = 0; i < 7; i++) {
            s.weekly[endOfDay + i * 86400] += earningPerTPerDay;
        }
        IERC20(s.earningToken).safeTransferFrom(
            custodian,
            address(this),
            effectiveHashratePerDay * earningPerTPerDay
        );
        emit Finalize(endOfDay, earningPerTPerDay);
    }

    function finalized() external view returns(uint128) {
        return s.finalized;
    }

    function earning(uint tokenId) external view returns(uint) {
        uint128 start = uint128(tokenId >> 128);
        uint128 end = uint128(tokenId);
        return _earning(start, end);
    }

    function supplyOf(uint id) external view returns(uint) {
        return s.supply[id];
    }

    function supplyOfBatch(
        uint[] calldata ids
    ) external view returns(uint[] memory) {
        uint[] memory res = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
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
        require(from != _alchemist, 'DeMineNFT: from alchemist');
        // alchemize
        if (to == _alchemist) {
            require(from != custodian, 'DeMineNFT: from custodian');
            require(!LibPausable.layout().paused, 'Pausable: paused');
            uint totalEarning;
            uint lastFinalized = s.finalized;
            for (uint i; i < ids.length; i++) {
                (uint128 start, uint128 end) = decode(ids[i]);
                require(end <= lastFinalized, 'DeMineNFT: token not finalized yet');
                totalEarning += amounts[i] * _earning(start, end);
            }
            IERC20(s.earningToken).safeTransfer(from, totalEarning);
            emit Alchemy(from, totalEarning);
        }
        if (from == address(0)) {
            require(
                to == custodian,
                'DeMineNFT: you can only mint to custodian'
            );
            for (uint i = 0; i < ids.length; i++) {
                s.supply[ids[i]] += amounts[i];
            }
        }
    }

    function decode(uint tokenId) private pure returns(uint128, uint128) {
        return (uint128(tokenId >> 128), uint128(tokenId));
    }

    function _earning(uint128 start, uint128 end)
        private
        view
        returns(uint value)
    {
        // daily token
        if (end - start == 86400) {
            value = s.daily[end];
        // weekly token
        } else if (end - start == 604800) {
            value = s.weekly[end];
        // biweekly token
        } else if (end - start == 1209600) {
            value = s.weekly[end] + s.weekly[end - 604800];
        }
    }
}
