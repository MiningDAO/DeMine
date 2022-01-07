// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import './CustodianStorage.sol';

abstract contract Custodian is OwnableInternal {
    event SetChecking(address checking);
    event SetSaving(address saving);

    function setChecking(address checking) external onlyOwner {
        CustodianStorage.layout().checking = checking;
        emit SetChecking(checking);
    }

    function setSaving(address saving) external onlyOwner {
        CustodianStorage.layout().saving = saving;
        emit SetSaving(saving);
    }
}
