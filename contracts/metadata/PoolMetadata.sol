// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';

import '../utils/PausableInternal.sol';
import './PoolMetadataInternal.sol';

contract PoolMetadata is
    PoolMetadataInternal,
    OwnableInternal,
    PausableInternal
{
    using PoolMetadataStorage for PoolMetadataStorage.Layout;

    event TransferPool(uint128 indexed, address, address);
    event SetPoolPrice(uint128 indexed, uint256);

    function transferPool(
        uint128 pool,
        address newOwner
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            newOwner != address(0),
            "Pool: new pool owner is zero address"
        );
        PoolMetadataStorage.layout().pools[pool].owner = newOwner;
        emit TransferPool(pool, _msgSender(), newOwner);
    }

    function setPoolPrice(
        uint128 pool,
        uint256 newPrice
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            newPrice >= PoolMetadataStorage.layout().cost(pool),
            "Pool: token price is lower than token cost"
        );
        PoolMetadataStorage.layout().pools[pool].tokenPrice = newPrice;
        emit SetPoolPrice(pool, newPrice);
    }

    function poolInfo(
        uint128 pool
    ) external view returns(address, uint256, uint256) {
        PoolMetadataStorage.Pool memory p
            = PoolMetadataStorage.layout().pools[pool];
        return (p.owner, p.tokenCost, p.tokenPrice);
    }
}
