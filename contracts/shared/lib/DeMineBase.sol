// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165Storage.sol';
import { IERC173 } from '@solidstate/contracts/access/IERC173.sol';
import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import '@solidstate/contracts/factory/CloneFactory.sol';

import './LibInitializable.sol';
import '../lib/LibPausable.sol';

abstract contract DeMineBase is
    DiamondBase,
    Initializable,
    Pausable,
    SafeOwnable,
    CloneFactory
{
    using ERC165Storage for ERC165Storage.Layout;
    using OwnableStorage for OwnableStorage.Layout;

    function __DeMineBase_init() internal onlyInitializing {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        erc165.setSupportedInterface(type(IERC173).interfaceId, true);
        erc165.setSupportedInterface(type(IPausable).interfaceId, true);
        OwnableStorage.layout().setOwner(msg.sender);
    }

    function clone() external returns(address) {
        return _deployClone();
    }

    function cloneDeterministic(bytes32 salt) external returns(address) {
        return _deployClone(salt);
    }

    function predictDeterministicAddress(bytes32 salt) external view returns(address) {
        return _calculateCloneDeploymentAddress(salt);
    }

    function getFallbackAddress() external view returns (address) {
        return DiamondBaseStorage.layout().fallbackAddress;
    }

    function setFallbackAddress(address fallbackAddress) external onlyOwner {
        DiamondBaseStorage.layout().fallbackAddress = fallbackAddress;
    }

    receive() external payable { }
}
