// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';

import '../utils/PausableInternal.sol';
import './PoolMetadataInternal.sol';

abstract contract PoolMetadataPublic is OwnableInternal {
    using PoolMetadataStorage for PoolMetadataStorage.Layout;

    event CreatePool(uint128 indexed, address, uint256, uint256);

    function createPool(
        address owner,
        uint256 tokenCost,
        uint256 tokenPrice
    ) public onlyOwner returns(uint128) {
        uint128 pool = PoolMetadataStorage.layout().create(
            owner, tokenCost, tokenPrice
        );
        emit CreatePool(pool, owner, tokenCost, tokenPrice);
        return pool;
    }
}
