// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '../AppStorage.sol';
import './PricingStorage.sol';

library LibPricingStatic {
    function priceOf(
        PricingStorage.Layout storage l,
        address account,
        uint256 tokenId
    ) internal view returns(uint256) {
        uint256 tokenPrice = l.staticOverride[account][tokenId];
        return tokenPrice > 0 ? tokenPrice : l.staticBase[account];
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
        ) = abi.decode(args, (uint256, uint256[], uint256[]));
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
        l.staticBase[from] = price;
    }

    function setOverride(
        PricingStorage.Layout storage l,
        uint256 minPrice,
        address from,
        uint256[] memory ids,
        uint256[] memory prices
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
            l.staticOverride[from][ids[i]] = prices[i];
        }
    }
}

abstract contract PricingStatic {
    using LibPricingStatic for PricingStorage.Layout;

    event SetStaticBase(address indexed, uint256);
    event SetStaticOverride(address indexed, uint256[], uint256[]);

    function setStaticBase(uint256 price) external {
        PricingStorage.layout().setBase(
            LibAppStorage.layout().tokenCost,
            msg.sender,
            price
        );
        emit SetStaticBase(msg.sender, price);
    }

    function setStaticOverride(
        uint256[] memory ids,
        uint256[] memory prices
    ) external {
        PricingStorage.layout().setOverride(
            LibAppStorage.layout().tokenCost,
            msg.sender,
            ids,
            prices
        );
        emit SetStaticOverride(msg.sender, ids, prices);
    }
}
