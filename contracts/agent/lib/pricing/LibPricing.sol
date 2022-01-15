// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import './LibPricingStatic.sol';
import './LibPricingLinearDecay.sol';

library LibPricing {
    function initialize(
        PricingStorage.Layout storage l,
        PricingStorage.PricingStrategy strategy,
        AppStorage storage s,
        address from,
        bytes memory args
    ) internal {
        l.settings[from] = strategy;
        if (strategy == PricingStorage.PricingStrategy.STATIC) {
            LibPricingStatic.initialize(s.tokenCost, from, args);
        } else if (strategy == PricingStorage.PricingStrategy.LINEAR_DECAY) {
            LibPricingLinearDecay.initialize(l, s.tokenCost, from, args);
        }
    }

    function priceOfFunc(
        PricingStorage.Layout storage l
    ) internal returns(
        function(
            PricingStorage.Layout storage,
            address,
            uint256
        ) internal view returns(uint256)
    ) internal view {
        PricingStorage.PricingStrategy strategy = l.settings[from];
        if (strategy == PricingStorage.PricingStrategy.STATIC) {
            return LibPricingStatic.priceOf;
        } else if (strategy == PricingStorage.PricingStrategy.LINEAR_DECAY) {
            return LibPricingLinearDecay.priceOf;
        }
    }
}
