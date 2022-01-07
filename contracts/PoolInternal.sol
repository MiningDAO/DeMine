// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";

import './TokenLockerStorage.sol';

abstract contract PoolInternal is Context {
    modifier onlyPoolOwner(uint128 pool) {
        require(
            _msgSender() == TokenLockerStorage.layout().pools[pool].owner,
            "PoolController: only pool owner allowed"
        );
        _;
    }
}
