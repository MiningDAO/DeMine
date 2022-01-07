// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library PoolMetadataStorage {
    struct Pool {
        address owner;
        uint256 tokenCost;
        uint256 tokenPrice;
    }

    struct Layout {
        uint128 next;
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

    function create(
        Layout storage l,
        address owner,
        uint256 tokenCost,
        uint256 tokenPrice
    ) internal returns(uint128) {
        require(
            owner != address(0),
            "PoolMetadata: pool owner is zero address"
        );
        uint128 pool = l.next;
        l.pools[pool].owner = owner;
        l.pools[pool].tokenCost = tokenCost;
        setPrice(l, pool, tokenPrice);
        l.next = pool + 1;
        return pool;
    }

    function setPrice(
        Layout storage l,
        uint128 pool,
        uint256 price
    ) internal {
        require(
            price >= l.pools[pool].tokenCost,
            "PoolMetadata: token price is lower than token cost"
        );
        l.pools[pool].tokenPrice = price;
    }

    function setOwner(
        Layout storage l,
        uint128 pool,
        address owner
    ) internal {
        require(
            owner != address(0),
            "PoolMetadata: new pool owner is zero address"
        );
        l.pools[pool].owner = owner;
    }
}
