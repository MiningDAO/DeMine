// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155BaseInternal.sol';

import '../utils/CustodianStorage.sol';
import '../utils/PausableInternal.sol';
import '../metadata/PoolMetadataInternal.sol';
import './DeMineNFTInternal.sol';
import './DeMineNFTMetadataStorage.sol';

contract DeMineNFTController is
    ERC1155BaseInternal,
    PoolMetadataInternal,
    OwnableInternal,
    PausableInternal,
    DeMineNFTInternal
{
    using DeMineNFTMetadataStorage for DeMineNFTMetadataStorage.Layout;
    using PoolMetadataStorage for PoolMetadataStorage.Layout;

    event NewPool(uint128 indexed, address, uint256, uint256);
    event Claim(address indexed, address indexed, uint128 indexed, address);
    event Redeem(address indexed, uint128 indexed, address);

    function newPoolWithSupply(
        address owner,
        uint256 tokenCost,
        uint256 basePrice,
        uint128 startCycle,
        uint128 numCycles,
        uint256[] calldata supplies
    ) external onlyOwner {
        require(
            owner != address(0),
            "Pool: pool owner is zero address"
        );
        require(
            basePrice >= tokenCost,
            "Pool: token price lower than cost"
        );
        uint128 pool = PoolMetadataStorage.layout().newPool(
            owner, tokenCost, basePrice
        );
        emit NewPool(pool, owner, tokenCost, basePrice);
        addSupply(pool, startCycle, numCycles, supplies);
    }

    function addSupply(
        uint128 pool,
        uint128 startCycle,
        uint128 numCycles,
        uint256[] calldata supplies
    ) public onlyOwner {
        require(
            pool < PoolMetadataStorage.layout().next(),
            "DeMineNFT: pool doesn't exsit"
        );
        require(
            supplies.length == numCycles,
            "TokenLocker: supply array length mismatch"
        );
        CycleMetadataStorage.Layout storage l = CycleMetadataStorage.layout();
        require(
            startCycle > l.cycle,
            "TokenLocker: started from rewarded cycle"
        );
        uint256[] memory ids = new uint256[](numCycles);
        for (uint128 i = 0; i < numCycles; i++) {
            uint128 cycle = startCycle + i;
            ids[i] = (uint256(pool) << 128) + cycle;
            l.cycles[cycle].supply += supplies[i];
        }
        _mintBatch(address(this), ids, supplies, "");
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
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        _burnBatch(address(this), ids, amounts);
        address custodian = CustodianStorage.layout().checking;
        _cashout(address(this), custodian, ids, amounts);
    }

    function _redeem(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    )
        internal
        returns(uint256[] memory)
    {
        require(
            cycles.length == amounts.length,
            "TokenLocker: array length mismatch"
        );
        uint256 tokenCost = PoolMetadataStorage.layout().cost(pool);
        uint256 totalCost;
        uint256[] memory ids = new uint256[](cycles.length);
        for (uint256 i = 0; i < cycles.length; i++) {
            ids[i] = (uint256(pool) << 128) + cycles[i];
            totalCost += tokenCost * amounts[i];
        }
        address custodian = CustodianStorage.layout().checking;
        payFrom(payment, _msgSender(), custodian, totalCost);
        emit Redeem(_msgSender(), pool, payment);
        return ids;
    }

    function _claim(
        address claimer,
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) internal returns(uint256[] memory) {
        require(
            cycles.length == amounts.length,
            "TokenLocker: array length mismatch"
        );
        uint256 basePrice = PoolMetadataStorage.layout().price(pool);
        uint256 totalToPay;
        uint256[] memory ids = new uint256[](cycles.length);
        DeMineNFTMetadataStorage.Layout
            storage l = DeMineNFTMetadataStorage.layout();
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            l.decreaseAllowance(id, claimer, amounts[i]);
            totalToPay += (
                l.prices[id] > 0 ? l.prices[id] : basePrice
            ) * amounts[i];
            ids[i] = id;
        }
        address custodian = CustodianStorage.layout().checking;
        payFrom(payment, _msgSender(), custodian, totalToPay);
        emit Claim(_msgSender(), claimer, pool, payment);
        return ids;
    }
}
