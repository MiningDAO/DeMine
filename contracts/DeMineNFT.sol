// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155Base.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155Metadata.sol';

import './utils/PausableInternal.sol';
import './utils/CustodianStorage.sol';
import './controller/RewarderInternal.sol';
import './controller/PoolControllerInternal.sol';
import './controller/TokenLockerInternal.sol';

contract DeMineNFT is
    ERC1155Base,
    ERC1155Metadata,
    OwnableInternal,
    PoolControllerInternal,
    PausableInternal,
    TokenLockerInternal,
    RewarderInternal,
    ERC165
{
    using PoolControllerStorage for PoolControllerStorage.Layout;

    function mint(
        uint128 pool,
        uint128 startCycle,
        uint128 numCycles,
        uint256[] calldata supplies
    ) external onlyOwner {
        require(
            pool < PoolControllerStorage.layout().next(),
            "TokenLocker: pool doesn't exsit"
        );
        _safeMintBatch(
            address(this),
            _addSupply(pool, startCycle, numCycles, supplies),
            supplies,
            ""
        );
    }

    function redeem(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused onlyPoolOwner(pool) {
        _safeTransferBatch(
            _msgSender(),
            address(this),
            _msgSender(),
            _redeem(payment, pool, cycles, amounts),
            amounts,
            ""
        );
    }

    function claimUnnamed(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused {
        _safeTransferBatch(
            _msgSender(),
            address(this),
            _msgSender(),
            _claim(address(0), payment, pool, cycles, amounts),
            amounts,
            ""
        );
    }

    function claim(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused {
        _safeTransferBatch(
            _msgSender(),
            address(this),
            _msgSender(),
            _claim(_msgSender(), payment, pool, cycles, amounts),
            amounts,
            ""
        );
    }

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

    function cashoutForBilling(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        _burnBatch(address(this), ids, amounts);
        address custodian = CustodianStorage.layout().checking;
        _cashout(address(this), custodian, ids, amounts);
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
