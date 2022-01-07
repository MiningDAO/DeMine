// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '../utils/PausableInternal.sol';
import './PoolMetadataInternal.sol';
import './PoolMetadataPublic.sol';

contract PoolMetadata is
    PoolMetadataInternal,
    PoolMetadataPublic,
    PausableInternal
{
    using PoolMetadataStorage for PoolMetadataStorage.Layout;

    event TransferPool(uint128 indexed, address, address);
    event SetPoolPrice(uint128 indexed, uint256);

    function transfer(
        uint128 pool,
        address owner
    ) external whenNotPaused onlyPoolOwner(pool) {
        PoolMetadataStorage.layout().setOwner(pool, owner);
        emit TransferPool(pool, _msgSender(), owner);
    }

    function setPrice(
        uint128 pool,
        uint256 price
    ) external whenNotPaused onlyPoolOwner(pool) {
        PoolMetadataStorage.layout().setPrice(pool, price);
        emit SetPoolPrice(pool, price);
    }

    function info(
        uint128 pool
    ) external view returns(address, uint256, uint256) {
        PoolMetadataStorage.Pool memory p
            = PoolMetadataStorage.layout().pools[pool];
        return (p.owner, p.tokenCost, p.tokenPrice);
    }
}
