// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '../interfaces/IPricingStrategy.sol';

contract PricingLinearDecay is IPricingStrategy {
    struct LinearDecay {
        uint maxPrice;
        uint128 anchor;
        uint64 slope;
        uint64 slopeBase;
    }

    mapping(address => LinearDecay) linearDecay;

    function setPrice(LinearDecay memory ld) external {
        linearDecay[msg.sender] = ld;
    }

    function priceOfBatch(
        address owner,
        uint minPrice,
        uint[] memory ids
    ) external override view returns(uint[] memory) {
        LinearDecay memory ld = linearDecay[owner];
        uint[] memory prices = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            uint128 end = uint128(ids[i]);
            uint128 start = uint128(ids[i] >> 128);
            uint128 middle = (end + start) / 2;
            uint price;
            if (middle < ld.anchor) {
                price = ld.maxPrice;
            } else {
                uint slope = (middle - ld.anchor) * ld.slope / ld.slopeBase;
                price = ld.maxPrice < slope ? 0 : ld.maxPrice - slope;
            }
            prices[i] = price > minPrice ? price : minPrice;
        }
        return prices;
    }
}
