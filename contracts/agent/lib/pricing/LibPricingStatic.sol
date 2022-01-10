// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '../AppStorage.sol';
import './PricingStorage.sol';

library LibPricingStatic {
    function priceOf(
        PricingStorage.Layout storage l,
        address mortagager,
        uint256 tokenId
    ) internal view returns(uint256) {
        uint256 tokenPrice = l.staticOverride[mortagager][tokenId];
        return tokenPrice > 0 ? tokenPrice : l.staticBase[mortagager];
    }

    function initialize(
        PricingStorage.Layout storage l,
        uint256 minPrice,
        address from,
        bytes memory args
    ) internal {
        (
            uint256 basePrice,
            uint256[] memory ids,
            uint256[] memory prices
        ) = abi.decode(args);
        setBase(l, minPrice, from,  basePrice);
        setOverride(l, minPrice, from, ids, prices);
    }

    function setBase(
        PricingStorage.Layout storage l,
        uint256 minPrice,
        address from,
        uint256 price
    ) internal {
        require(
            price >= minPrice,
            "LibPricingStatic: price is lower than token cost"
        );
        l.staticBase[from] = basePrice;
    }

    function setOverride(
        PricingStorage.Layout storage l,
        uint256 minPrice,
        address from,
        uint256[] calldata ids,
        uint256[] calldata prices
    ) internal {
        require(
            ids.length == prices.length,
            "LibPricingStatic: base price is lower than token cost"
        );
        for (uint256 i = 0; i < ids.length; i++) {
            require(
                prices[i] >= minPrice,
                "LibPricingStatic: price too low to cover cost"
            );
            l.override[from][ids[i]] = prices[i];
        }
    }
}

abstract PricingStatic {
    using LibPricingStatic for PricingStorage.Layout;
    AppStorage internal s;

    event SetBasePrice(address indexed, uint256);
    event SetTokenPrices(address indexed, uint256[], uint256[]);

    function setStaticBase(uint256 price) external {
        PricingStorage.layout().setBase(s.tokenCost, msg.sender, price);
        emit SetStaticBase(msg.sender, price);
    }

    function setStaticOverride(
        uint256[] ids,
        uint256[] prices
    ) external {
        PricingStorage.layout().setOverride(
            s.tokenCost,
            msg.sender,
            ids,
            prices
        );
        emit setStaticOverride(msg.sender, ids, prices);
    }
}
