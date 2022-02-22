// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '../../shared/lib/Util.sol';
import '../interfaces/IPricingStrategy.sol';
import './AppStorage.sol';
import './PricingLinearDecayStorage.sol';

contract PricingLinearDecay is IPricingStrategy {
    function set(
        address owner,
        uint tokenCost,
        bytes memory args
    ) external override {
        PricingLinearDecayStorage.Layout storage l
            = PricingLinearDecayStorage.layout();
        PricingLinearDecayStorage.LinearDecay memory ld = abi.decode(
            args, (PricingLinearDecayStorage.LinearDecay)
        );
        require(
            ld.maxPrice >= ld.minPrice && ld.minPrice >= tokenCost,
            'PricingLinearDecay: invalid max or min price'
        );
        l.linearDecay[owner] = ld;
    }

    function priceOfBatch(
        address owner,
        uint[] memory ids
    ) external override view returns(uint[] memory) {
        uint[] memory prices = new uint[](ids.length);
        PricingLinearDecayStorage.LinearDecay memory ld
            = PricingLinearDecayStorage.layout().linearDecay[owner];
        for (uint i = 0; i < ids.length; i++) {
            uint128 end = uint128(ids[i]);
            uint128 start = uint128(ids[i] >> 128);
            uint128 middle = (end + start) / 2;
            if (middle < ld.anchor) {
                prices[i] = ld.maxPrice;
            } else {
                uint slope = (middle - ld.anchor) * ld.slope / ld.slopeBase;
                if (ld.maxPrice - ld.minPrice < slope) {
                    prices[i] = ld.minPrice;
                } else {
                    prices[i] = ld.maxPrice - slope;
                }
            }
        }
        return prices;
    }
}
