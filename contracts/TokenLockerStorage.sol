// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library TokenLockerStorage {
    struct Pool {
        address owner;
        uint256 cost; // per token
        uint256 price; // per token
    }

    struct Layout {
        uint128 nextPool;
        mapping(uint128 => Pool) pools;
        mapping(uint256 => uint256) prices;
        mapping(uint256 => mapping(address => uint256)) allowances;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.TokenLocker');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function newPool(
        Layout storage l,
        address owner,
        uint256 cost,
        uint256 price
    ) internal returns(uint128) {
        uint128 pool = l.nextPool;
        l.pools[pool].owner = owner;
        l.pools[pool].cost = cost;
        l.pools[pool].price = price;
        l.nextPool = pool + 1;
        return pool;
    }

    function decreaseAllowance(
        Layout storage l,
        uint256 id,
        address claimer,
        uint256 amount
    ) internal {
        uint256 allowance = l.allowances[id][claimer];
        require(
            allowance >= amount,
            "TokenLocker: insufficient allowance"
        );
        l.allowances[id][claimer] = allowance - amount;
    }
}
