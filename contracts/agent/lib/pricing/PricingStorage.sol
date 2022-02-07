// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

library PricingStorage {
    enum PricingStrategy{ STATIC, LINEAR_DECAY }

    struct LinearDecay {
        uint anchor;
        uint128 slope;
        uint128 slopeBase;
        uint maxPrice;
        uint minPrice;
    }

    struct Layout {
        mapping(address => PricingStrategy) strategy;
        // static pricing
        mapping(address => uint) staticBase;
        mapping(address => mapping(uint => uint)) staticOverride;
        // linear decay
        mapping(address => LinearDecay) linearDecay;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('demine.agent.contracts.storage.Pricing');

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
