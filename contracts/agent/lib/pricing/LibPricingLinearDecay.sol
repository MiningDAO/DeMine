// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '../AppStorage.sol';
import './PricingStorage.sol';

library LibPricingLinearDecay {
    function priceOf(
        PricingStorage.Layout storage l,
        address account,
        uint128 cycle
    ) internal view returns(uint256) {
        PricingStorage.LinearDecay memory ld = l.linearDecay[account];
        if (cycle < ld.anchor) {
            return ld.maxPrice;
        }
        uint256 delta = cycle - ld.anchor;
        uint256 price = ld.maxPrice * (
            ld.slopeBase - delta * ld.slope
        ) / ld.slopeBase;
        return price > ld.minPrice ? price : ld.minPrice;
    }

    function initialize(
        PricingStorage.Layout storage l,
        address from,
        bytes memory args
    ) internal {
        PricingStorage.LinearDecay memory ld
            = abi.decode(args, (PricingStorage.LinearDecay));
        l.linearDecay[from] = ld;
    }
}

abstract contract PricingLinearDecay {
    using LibPricingLinearDecay for PricingStorage.Layout;

    event SetLinerPricing(
        address indexed,
        uint128,
        uint64,
        uint64
        uint,
        uint,
    );

    function setLinearDecay(
        PricingStorage.LinearDecay memory ld
    ) external {
        PricingStorage.layout().linearDecay[from] = ld;
        emit SetLinerPricing(
            msg.sender,
            ld.anchor,
            ld.slope,
            ld.slopeBase,
            ld.maxPrice,
            ld.minPrice
        );
    }
}
