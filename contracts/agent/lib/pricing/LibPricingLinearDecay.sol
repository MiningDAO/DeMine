// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '../AppStorage.sol';
import './PricingStorage.sol';

library LibPricingLinearDecay {
    function priceOf(
        PricingStorage.Layout storage l,
        address account,
        uint256 tokenId
    ) internal view returns(uint256) {
        PricingStorage.LinearDecay memory ld = l.linearDecay[account];
        if (tokenId < ld.anchor) {
            return ld.maxPrice;
        }
        uint256 delta = tokenId - ld.anchor;
        uint256 price = ld.maxPrice * (
            ld.slopeBase - delta * ld.slope
        ) / ld.slopeBase;
        return price > ld.minPrice ? price : ld.minPrice;
    }

    function initialize(
        PricingStorage.Layout storage l,
        uint256 tokenCost,
        address from,
        bytes memory args
    ) internal {
        PricingStorage.LinearDecay memory ld
            = abi.decode(args, (PricingStorage.LinearDecay));
        setLinearDecay(l, from, tokenCost, ld);
    }

    function setLinearDecay(
        PricingStorage.Layout storage l,
        address from,
        uint256 tokenCost,
        PricingStorage.LinearDecay memory ld
    ) internal {
        require(
            ld.minPrice > tokenCost,
            'LibPricingLinear: price too low to cover cost'
        );
        l.linearDecay[from] = ld;
    }
}

abstract contract PricingLinearDecay {
    using LibPricingLinearDecay for PricingStorage.Layout;

    event SetLinerPricing(
        address indexed,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256
    );

    function setLinearDecay(
        PricingStorage.LinearDecay memory ld
    ) external {
        PricingStorage.layout().setLinearDecay(
            msg.sender,
            LibAppStorage.layout().tokenCost,
            ld
        );
        emit SetLinerPricing(
            msg.sender,
            ld.anchor,
            ld.maxPrice,
            ld.minPrice,
            ld.slope,
            ld.slopeBase
        );
    }
}
