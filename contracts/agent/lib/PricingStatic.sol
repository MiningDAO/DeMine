// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '../interfaces/IPricingStrategy.sol';

contract PricingStatic is IPricingStrategy {
    mapping(address => uint) base;
    mapping(address => mapping(uint => uint)) overrides;

    function setPrice(
        uint basePrice,
        uint[] memory ids,
        uint[] memory prices
    ) external {
        require(
            ids.length == prices.length,
            "PricingStatic: array length mismatch"
        );
        base[msg.sender] = basePrice;
        for (uint i = 0; i < ids.length; i++) {
            overrides[msg.sender][ids[i]] = prices[i];
        }
    }

    function priceOfBatch(
        address owner,
        uint minPrice,
        uint[] memory ids
    ) external override view returns(uint[] memory) {
        uint basePrice = base[owner];
        uint[] memory prices = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            uint tokenPrice = overrides[owner][ids[i]];
            uint price = tokenPrice > 0 ? tokenPrice : basePrice;
            prices[i] = price > minPrice ? price : minPrice;
        }
        return prices;
    }
}
