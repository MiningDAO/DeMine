// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library CustodianStorage {
    struct Layout {
        address checking;
        address saving;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.Custodian');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
