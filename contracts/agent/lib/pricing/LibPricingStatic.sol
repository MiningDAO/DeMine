// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '../../../shared/lib/Util.sol';
import '../AppStorage.sol';
import './PricingStorage.sol';

library LibPricingStatic {
    function priceOf(
        PricingStorage.Layout storage l,
        address account,
        uint128 cycle,
        uint tokenCost
    ) internal view returns(uint) {
        uint tokenPrice = l.staticOverride[account][cycle];
        return Util.max2(
            tokenPrice > 0 ? tokenPrice : l.staticBase[account],
            tokenCost
        );
    }

    function initialize(
        PricingStorage.Layout storage l,
        address from,
        bytes memory args
    ) internal {
        (
            uint basePrice,
            uint128[] memory cycles,
            uint[] memory prices
        ) = abi.decode(args, (uint, uint128[], uint[]));
        l.staticBase[from] = basePrice;
        setOverride(l, from, cycles, prices);
    }

    function setOverride(
        PricingStorage.Layout storage l,
        address from,
        uint128[] memory cycles,
        uint[] memory prices
    ) internal {
        require(
            cycles.length == prices.length,
            "LibPricingStatic: base price is lower than token cost"
        );
        for (uint i = 0; i < cycles.length; i++) {
            l.staticOverride[from][cycles[i]] = prices[i];
        }
    }
}

abstract contract PricingStatic {
    using LibPricingStatic for PricingStorage.Layout;

    event SetStaticBase(address indexed, uint);
    event SetStaticOverride(address indexed, uint128[], uint[]);

    function setStaticBase(uint price) external {
        PricingStorage.layout().staticBase[msg.sender] = price;
        emit SetStaticBase(msg.sender, price);
    }

    function setStaticOverride(
        uint128[] memory cycles,
        uint[] memory prices
    ) external {
        PricingStorage.layout().setOverride(msg.sender, cycles, prices);
        emit SetStaticOverride(msg.sender, cycles, prices);
    }
}
