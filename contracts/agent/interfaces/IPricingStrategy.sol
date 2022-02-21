// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IPricingStrategy {
    function set(
        address owner,
        uint minPrice,
        bytes memory args
    ) external;

    function priceOfBatch(
        address owner,
        uint[] memory ids
    ) external view returns(uint[] memory);
}
