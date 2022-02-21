// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IAllowanceStrategy {
    function set(
        address owner,
        address buyer,
        bytes memory args
    ) external;

    function checkAllowances(
        address owner,
        address buyer,
        uint[] memory ids,
        uint[] memory amounts
    ) external;

    function allowanceOfBatch(
        address owner,
        address buyer,
        uint[] memory ids
    ) external view returns(uint[] memory);
}
