// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

library PricingStaticStorage {
    struct Layout {
        mapping(address => uint) base;
        mapping(address => mapping(uint => uint)) overrides;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('mining3.agent.contracts.storage.PricingStatic');

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
