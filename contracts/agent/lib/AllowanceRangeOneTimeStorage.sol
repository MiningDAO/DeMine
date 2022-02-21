// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

library AllowanceRangeOneTimeStorage {
    struct RangeAllowance {
        uint128 start;
        uint128 end;
        uint allowance;
    }

    struct Layout {
        mapping(address => mapping(address => RangeAllowance)) allowances;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('mining3.agent.contracts.storage.AllowanceRange');

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
