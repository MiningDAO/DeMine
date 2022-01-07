// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library ERC2981Storage {
    struct Layout {
        uint16 bps;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.ERC2981');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
