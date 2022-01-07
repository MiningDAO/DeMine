// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library PoolMetadataStorage {
    event NewPool(uint128 indexed, address, uint256, uint256);

    struct Pool {
        address owner;
        uint256 tokenCost;
        uint256 tokenPrice;
    }

    struct Layout {
        uint128 nextPool;
        mapping(uint128 => Pool) pools;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.Pool');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function newPool(
        Layout storage l,
        address owner,
        uint256 tokenCost,
        uint256 tokenPrice
    ) internal returns(uint128) {
        require(
            owner != address(0),
            "Pool: pool owner is zero address"
        );
        require(
            tokenPrice >= tokenCost,
            "Pool: token price lower than cost"
        );
        uint128 pool = l.nextPool;
        l.pools[pool].owner = owner;
        l.pools[pool].tokenCost = tokenCost;
        l.pools[pool].tokenPrice = tokenPrice;
        l.nextPool = pool + 1;
        emit NewPool(pool, owner, tokenCost, tokenPrice);
        return pool;
    }

    function price(
        Layout storage l,
        uint128 pool
    ) internal view returns(uint256) {
        return l.pools[pool].tokenPrice;
    }

    function cost(
        Layout storage l,
        uint128 pool
    ) internal view returns(uint256) {
        return l.pools[pool].tokenCost;
    }

    function next(Layout storage l) internal view returns(uint128) {
        return l.nextPool;
    }
}
