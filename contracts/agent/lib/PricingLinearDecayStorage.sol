// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

library PricingLinearDecayStorage {
    struct LinearDecay {
        uint maxPrice;
        uint minPrice;
        uint128 anchor;
        uint64 slope;
        uint64 slopeBase;
    }

    struct Layout {
        mapping(address => LinearDecay) linearDecay;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('mining3.agent.contracts.storage.PricingLinearDecay');

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
