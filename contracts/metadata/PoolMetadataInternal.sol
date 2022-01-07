// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";

import './PoolMetadataStorage.sol';

abstract contract PoolMetadataInternal is Context {
    event CreatePool(uint128 indexed, address, uint256, uint256);

    modifier onlyPoolOwner(uint128 pool) {
        require(
            _msgSender() == PoolMetadataStorage.layout().pools[pool].owner,
            "PoolMetadata: only pool owner allowed"
        );
        _;
    }

    modifier onlyExistingPool(uint128 pool) {
        require(
            pool < PoolMetadataStorage.layout().next,
            "PoolMetadata: pool doesn't exsit"
        );
        _;
    }

    function getTokenCost(uint128 pool) internal view returns(uint256) {
        return PoolMetadataStorage.layout().pools[pool].tokenCost;
    }

    function getDefaultTokenPrice(
        uint128 pool
    ) internal view returns(uint256) {
        return PoolMetadataStorage.layout().pools[pool].tokenPrice;
    }
}
