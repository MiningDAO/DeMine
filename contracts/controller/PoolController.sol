// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';

import '../utils/PausableInternal.sol';
import './PoolControllerInternal.sol';

contract PoolController is
    PoolControllerInternal,
    OwnableInternal,
    PausableInternal
{
    using PoolControllerStorage for PoolControllerStorage.Layout;

    event NewPool(uint128 indexed, address, uint256, uint256);
    event TransferPool(uint128 indexed, address, address);
    event SetPoolPrice(uint128 indexed, uint256);

    function newPool(
        address owner,
        uint256 tokenCost,
        uint256 basePrice
    ) external onlyOwner {
        require(
            owner != address(0),
            "Pool: pool owner is zero address"
        );
        require(
            basePrice >= tokenCost,
            "Pool: token price lower than cost"
        );
        uint128 pool = PoolControllerStorage.layout().newPool(
            owner, tokenCost, basePrice
        );
        emit NewPool(pool, owner, tokenCost, basePrice);
    }

    function transferPool(
        uint128 pool,
        address newOwner
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            newOwner != address(0),
            "Pool: new pool owner is zero address"
        );
        PoolControllerStorage.layout().pools[pool].owner = newOwner;
        emit TransferPool(pool, _msgSender(), newOwner);
    }

    function setPoolPrice(
        uint128 pool,
        uint256 newPrice
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            newPrice >= PoolControllerStorage.layout().cost(pool),
            "Pool: token price is lower than token cost"
        );
        PoolControllerStorage.layout().pools[pool].tokenPrice = newPrice;
        emit SetPoolPrice(pool, newPrice);
    }

    function poolInfo(
        uint128 pool
    ) external view returns(address, uint256, uint256) {
        PoolControllerStorage.Pool memory p
            = PoolControllerStorage.layout().pools[pool];
        return (p.owner, p.tokenCost, p.tokenPrice);
    }
}
