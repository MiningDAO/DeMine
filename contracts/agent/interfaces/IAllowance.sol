// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IAllowance {
    function set(
        address owner,
        address buyer,
        bytes memory args
    ) external;

    function allowanceOfBatch(
        address owner,
        address buyer,
        uint[] memory ids
    ) external view returns(uint[] memory);
}
