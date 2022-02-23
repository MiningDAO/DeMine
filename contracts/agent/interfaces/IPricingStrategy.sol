// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IPricingStrategy {
    function priceOfBatch(
        address owner,
        uint minPrice,
        uint[] memory ids
    ) external view returns(uint[] memory);
}
