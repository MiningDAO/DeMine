// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

library AllowanceFixedOneTimeStorage {
    struct Layout {
        mapping(address => mapping(address => uint)) allowances;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('mining3.agent.contracts.storage.AllowanceStaticOneTime');

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
