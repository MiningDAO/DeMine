// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';

library LibCustodian {
    struct Layout {
        address checking;
        address saving;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.Custodian');

    function layout() internal pure returns(Layout storage s) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            s.slot := slot
        }
    }
}

abstract contract Custodian is OwnableInternal {
    event SetChecking(address checking);
    event SetSaving(address saving);

    function setChecking(address checking) external onlyOwner {
        LibCustodian.layout().checking = checking;
        emit SetChecking(checking);
    }

    function setSaving(address saving) external onlyOwner {
        LibCustodian.layout().saving = saving;
        emit SetSaving(saving);
    }
}
