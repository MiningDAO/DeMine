// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import './AppStorage.sol';

library LibAppStorage {
    function layout() internal pure returns (AppStorage storage ds) {
        assembly {
            ds.slot := 0
        }
    }

    function createPool(
        AppStorage storage s,
        address owner,
        uint256 tokenCost,
        uint256 tokenPrice
    ) internal returns(uint128) {
        require(
            owner != address(0),
            "PoolMetadata: pool owner is zero address"
        );
        uint128 pool = s.nextPool;
        s.pools[pool].owner = owner;
        s.pools[pool].tokenCost = tokenCost;
        setDefaultTokenPrice(s, pool, tokenPrice);
        s.nextPool = pool + 1;
        return pool;
    }

    function setDefaultTokenPrice(
        AppStorage storage s,
        uint128 pool,
        uint256 price
    ) internal {
        require(
            price >= s.pools[pool].tokenCost,
            "PoolMetadata: token price is lower than token cost"
        );
        s.pools[pool].tokenPrice = price;
    }

    function setPoolOwner(
        AppStorage storage s,
        uint128 pool,
        address owner
    ) internal {
        require(
            owner != address(0),
            "PoolMetadata: new pool owner is zero address"
        );
        s.pools[pool].owner = owner;
    }

    function decreaseAllowance(
        AppStorage storage s,
        uint256 id,
        address claimer,
        uint256 amount
    ) internal {
        uint256 allowance = s.allowances[id][claimer];
        require(
            allowance >= amount,
            "TokenLocker: insufficient allowance"
        );
        s.allowances[id][claimer] = allowance - amount;
    }
}
