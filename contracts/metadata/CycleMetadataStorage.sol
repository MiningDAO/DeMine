// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library CycleMetadataStorage {
    struct Cycle {
        uint256 supply;
        uint256 reward; // per token
    }

    struct Layout {
        uint128 cycle;
        address rewardToken;
        mapping(uint128 => Cycle) cycles;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.CycleMetadata');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function next(Layout storage l) internal {
        l.cycle += 1;
    }
}
