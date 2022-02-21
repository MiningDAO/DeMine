// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '../../shared/lib/Util.sol';
import '../interfaces/IPricingStrategy.sol';
import './PricingStaticStorage.sol';

contract PricingStatic is IPricingStrategy {
    function set(
        address owner,
        uint tokenCost,
        bytes memory args
    ) external override {
        PricingStaticStorage.Layout storage l = PricingStaticStorage.layout();
        (
            uint basePrice,
            uint[] memory ids,
            uint[] memory prices
        ) = abi.decode(args, (uint, uint[], uint[]));
        require(
            basePrice >= tokenCost,
            'PricingStatic: price smaller than token cost'
        );
        l.base[owner] = basePrice;
        require(
            ids.length == prices.length,
            "PricingStatic: array length mismatch"
        );
        for (uint i = 0; i < ids.length; i++) {
            require(
                prices[i] >= tokenCost,
                'PricingStatic: price smaller than token cost'
            );
            l.overrides[owner][ids[i]] = prices[i];
        }
    }

    function priceOfBatch(
        address owner,
        uint[] memory ids
    ) external override view returns(uint[] memory) {
        PricingStaticStorage.Layout storage l = PricingStaticStorage.layout();
        uint base = l.base[owner];
        uint[] memory prices = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            uint tokenPrice = l.overrides[owner][ids[i]];
            prices[i] = tokenPrice > 0 ? tokenPrice : base;
        }
        return prices;
    }
}
