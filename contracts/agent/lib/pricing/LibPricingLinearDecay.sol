// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '../AppStorage.sol';
import './PricingStorage.sol';

library LibPricingLinearDecay {
    function priceOf(
        PricingStorage.Layout storage l,
        address mortgager,
        uint256 tokenId
    ) internal view returns(uint256) {
        PricingStorage.Pricing storage linear = l.pricing[mortgager];
        uint256 anchor = linear.linearAnchor;
        uint256 maxPrice = linear.linearMaxPrice;
        uint256 minPrice = linear.linearMinPrice;
        uint256 slopeBase = linear.linearSlopeBase;

        if (tokenId < anchor) {
            return maxPrice;
        }
        uint256 delta = tokenId - anchor;
        uint256 price = maxPrice * (
            slopeBase - delta * linear.linearSlope
        ) / slopeBase;
        return price > minPrice ? price : minPrice;
    }

    function initialize(
        PricingStorage.Layout storage l,
        uint256 tokenCost,
        address from,
        bytes memory args
    ) internal {
        (
            uint256 anchor,
            uint256 maxPrice,
            uint256 minPrice,
            uint256 slope,
            uint256 slopeBase
        ) = abi.decode(args);
        setLinearPricing(
            l,
            from,
            tokenCost,
            anchor,
            maxPrice,
            minPrice,
            slope,
            slopeBase
        );
    }

    function setLinearPricing(
        PricingStorage.Layout storage l,
        address from,
        uint256 tokenCost,
        address from,
        uint256 anchor,
        uint256 maxPrice,
        uint256 minPrice,
        uint256 slope,
        uint256 slopeBase
    ) internal {
        require(
            minPrice > tokenCost,
            'LibPricingLinear: price too low to cover cost'
        );
        l.pricing[from].linearAnchoredToken = anchor;
        l.pricing[from].linearMaxPrice = maxPrice;
        l.pricing[from].linearMinPrice = minPrice;
        l.pricing[from].linearSlope = slope;
        l.pricing[from].linearSlopeBase = slopeBase;
    }
}

abstract PricingLinearDecay {
    using LibPricingLinear for PricingStorage.Layout;
    AppStorage internal s;

    event SetLinerPricing(
        address indexed,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256
    );

    function setLinearPricing(
        uint256 anchor,
        uint256 maxPrice,
        uint256 minPrice,
        uint256 slope,
        uint256 slopeBase
    ) external {
        PricingStorage.layout().setLinearPricing(
            msg.sender,
            s.tokenCost,
            anchor,
            maxPrice,
            minPrice,
            slope,
            slopeBase
        );
        emit SetLinerPricing(
            msg.sender,
            anchor,
            maxPrice,
            minPrice,
            slope,
            slopeBase
        );
    }
}
