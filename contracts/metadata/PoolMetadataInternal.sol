// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";

import './PoolMetadataStorage.sol';

abstract contract PoolMetadataInternal is Context {
    modifier onlyPoolOwner(uint128 pool) {
        require(
            _msgSender() == PoolMetadataStorage.layout().pools[pool].owner,
            "PoolMetadata: only pool owner allowed"
        );
        _;
    }
}
