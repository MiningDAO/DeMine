// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface ICloneable {
    function clone() external returns(address);

    function cloneDeterministic(bytes32 salt) external returns(address);

    function predictDeterministicAddress(bytes32 salt) external view returns(address);
}
