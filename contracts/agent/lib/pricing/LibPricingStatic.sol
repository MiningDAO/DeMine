// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '../../../shared/lib/Util.sol';
import '../AppStorage.sol';
import './PricingStorage.sol';

library LibPricingStatic {
    function priceOf(
        PricingStorage.Layout storage l,
        address account,
        uint id,
        uint tokenCost
    ) internal view returns(uint) {
        uint tokenPrice = l.staticOverride[account][id];
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
            uint[] memory ids,
            uint[] memory prices
        ) = abi.decode(args, (uint, uint[], uint[]));
        l.staticBase[from] = basePrice;
        setOverride(l, from, ids, prices);
    }

    function setOverride(
        PricingStorage.Layout storage l,
        address from,
        uint[] memory ids,
        uint[] memory prices
    ) internal {
        require(
            ids.length == prices.length,
            "LibPricingStatic: base price is lower than token cost"
        );
        for (uint i = 0; i < ids.length; i++) {
            l.staticOverride[from][ids[i]] = prices[i];
        }
    }
}

abstract contract PricingStatic {
    using LibPricingStatic for PricingStorage.Layout;

    event SetStaticBase(address indexed, uint);
    event SetStaticOverride(address indexed, uint[], uint[]);

    function setStaticBase(uint price) external {
        PricingStorage.layout().staticBase[msg.sender] = price;
        emit SetStaticBase(msg.sender, price);
    }

    function setStaticOverride(
        uint[] memory ids,
        uint[] memory prices
    ) external {
        PricingStorage.layout().setOverride(msg.sender, ids, prices);
        emit SetStaticOverride(msg.sender, ids, prices);
    }
}
