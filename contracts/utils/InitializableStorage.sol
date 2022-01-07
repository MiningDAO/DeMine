// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library InitializableStorage {
    struct Layout {
        bool initialized;
        bool initializing;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.Initializable');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
