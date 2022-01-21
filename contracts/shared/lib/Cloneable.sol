// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/factory/CloneFactory.sol';
import '../interfaces/ICloneable.sol';

abstract contract Cloneable is ICloneable, CloneFactory {
    function clone() external override returns(address) {
        return _deployClone();
    }

    function cloneDeterministic(bytes32 salt) external override returns(address) {
        return _deployClone(salt);
    }

    function predictDeterministicAddress(bytes32 salt) external override view returns(address) {
        return _calculateCloneDeploymentAddress(salt);
    }
}
