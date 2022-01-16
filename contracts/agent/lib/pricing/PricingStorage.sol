// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library PricingStorage {
    enum PricingStrategy{ STATIC, LINEAR_DECAY }

    struct LinearDecay {
        uint256 anchor;
        uint256 maxPrice;
        uint256 minPrice;
        uint256 slope;
        uint256 slopeBase;
    }

    struct Layout {
        mapping(address => PricingStrategy) strategy;
        // static pricing
        mapping(address => uint256) staticBase;
        mapping(address => mapping(uint256 => uint256)) staticOverride;
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
