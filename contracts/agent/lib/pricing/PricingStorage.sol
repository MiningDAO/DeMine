// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library PricingStorage {
    enum PricingStrategy{ STATIC, LINEAR }

    struct Pricing {
        PricingStrategy strategy;
        // static pricing
        uint256 staticBase;
        mapping(uint256 => uint256) staticOverride;
        // for linear pricing
        uint256 linearAnchor;
        uint256 linearMaxPrice;
        uint256 linearMinPrice;
        uint256 linearSlope;
        uint256 linearSlopeBase;
    }

    struct Layout {
        mapping(address => Pricing) pricing;
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
