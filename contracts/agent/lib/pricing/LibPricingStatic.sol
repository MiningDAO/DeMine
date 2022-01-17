// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '../AppStorage.sol';
import './PricingStorage.sol';

library LibPricingStatic {
    function priceOf(
        PricingStorage.Layout storage l,
        address account,
        uint128 cycle
    ) internal view returns(uint256) {
        uint256 tokenPrice = l.staticOverride[account][cycle];
        return tokenPrice > 0 ? tokenPrice : l.staticBase[account];
    }

    function initialize(
        PricingStorage.Layout storage l,
        address from,
        bytes memory args
    ) internal {
        (
            uint256 basePrice,
            uint128[] memory cycles,
            uint256[] memory prices
        ) = abi.decode(args, (uint256, uint256[], uint256[]));
        l.staticBase[from] = price;
        setOverride(l, from, cycles, prices);
    }

    function setOverride(
        PricingStorage.Layout storage l,
        address from,
        uint128[] memory cycles,
        uint256[] memory prices
    ) internal {
        require(
            cycles.length == prices.length,
            "LibPricingStatic: base price is lower than token cost"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            l.staticOverride[from][cycles[i]] = prices[i];
        }
    }
}

abstract contract PricingStatic {
    using LibPricingStatic for PricingStorage.Layout;

    event SetStaticBase(address indexed, uint256);
    event SetStaticOverride(address indexed, uint128[], uint256[]);

    function setStaticBase(uint256 price) external {
        PricingStorage.layout().staticBase[from] = price;
        emit SetStaticBase(msg.sender, price);
    }

    function setStaticOverride(
        uint128[] memory cycles,
        uint256[] memory prices
    ) external {
        PricingStorage.layout().setOverride(msg.sender, cycles, prices);
        emit SetStaticOverride(msg.sender, cycles, prices);
    }
}
