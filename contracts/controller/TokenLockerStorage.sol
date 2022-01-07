// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library TokenLockerStorage {
    struct Layout {
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
