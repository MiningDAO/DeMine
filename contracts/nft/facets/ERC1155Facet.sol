// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/LibInitializable.sol';
import './ERC1155Config.sol';

contract ERC1155Facet is
    Initializable,
    ERC1155Base,
    ERC1155Config,
    ERC165
{
    using SafeERC20 for IERC20;

    function init(address _earningToken) external onlyInitializing {
        s.earningToken = _earningToken;
        s.royalty = RoyaltyInfo(
            OwnableStorage.layout().owner, 100
        );
    }

    constructor(address custodian) ERC1155Config(custodian) {}

    function mint(
        uint[] calldata ids,
        uint[] calldata amounts,
        bytes memory data
    ) external onlyOwner {
        _safeMintBatch(_custodian, ids, amounts, data);
    }

    function finalize(
        uint128 endOfDay,
        uint earningPerTPerDay,
        address custodian,
        uint totalEarning
    ) external onlyOwner {
        require(
            endOfDay > s.finalized && endOfDay % 86400 == 0,
            'NFT: invalid timestamp'
        );
        s.finalized = endOfDay;
        s.daily[endOfDay] = earningPerTPerDay;
        for(uint128 i = 0; i < 7; i++) {
            s.weekly[endOfDay + i * 86400] += earningPerTPerDay;
        }
        IERC20(s.earningToken).safeTransferFrom(
            custodian,
            address(this),
            totalEarning
        );
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint[] memory ids,
        uint[] memory amounts,
        bytes memory data
    ) internal nonReentrant virtual override(ERC1155BaseInternal) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        // mint
        if (from == address(0)) {
            for (uint i = 0; i < ids.length; i++) {
                s.supply[ids[i]] += amounts[i];
            }
        // alchemize or burn
        } else if (to == _custodian) {
            require(from != _custodian, 'NFT: custodian is not allowed');
            require(!LibPausable.layout().paused, 'Pausable: paused');
            uint totalEarning;
            uint lastFinalized = s.finalized;
            for (uint i; i < ids.length; i++) {
                uint128 end = uint128(ids[i]);
                if (end <= lastFinalized) { // already finalized
                    uint128 start = uint128(ids[i] >> 128);
                    totalEarning += amounts[i] * _earning(start, end);
                }
            }
            if (totalEarning > 0) {
                IERC20(s.earningToken).safeTransfer(from, totalEarning);
            }
        }
    }
}
