// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165Storage.sol';
import '@solidstate/contracts/access/SafeOwnable.sol';
import { IERC173 } from '@solidstate/contracts/access/IERC173.sol';
import '@solidstate/contracts/factory/CloneFactory.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';

import '../interfaces/ICloneable.sol';
import '../interfaces/IDiamondFacet.sol';
import '../lib/LibPausable.sol';

contract DeMineBaseFacet is
    ICloneable,
    IDiamondFacet,
    Pausable,
    SafeOwnable,
    CloneFactory
{
    using ERC165Storage for ERC165Storage.Layout;

    function clone() external override returns(address) {
        return _deployClone();
    }

    function cloneDeterministic(bytes32 salt) external override returns(address) {
        return _deployClone(salt);
    }

    function predictDeterministicAddress(bytes32 salt) external override view returns(address) {
        return _calculateCloneDeploymentAddress(salt);
    }

    function genFacetCutAdd()
        external
        override
        returns(IDiamondCuttable.FacetCut memory)
    {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        bytes4[] memory selectors = new bytes4[](6);

        // register SafeOwnable
        selectors[0] = Ownable.owner.selector;
        selectors[1] = SafeOwnable.nomineeOwner.selector;
        selectors[2] = SafeOwnable.transferOwnership.selector;
        selectors[3] = SafeOwnable.acceptOwnership.selector;
        erc165.setSupportedInterface(type(IERC173).interfaceId, true);

        // register IPausable
        selectors[4] = IPausable.paused.selector;
        selectors[5] = IPausable.pause.selector;
        selectors[6] = IPausable.unpause.selector;
        erc165.setSupportedInterface(type(IPausable).interfaceId, true);

        // register ICloneable
        selectors[4] = ICloneable.clone.selector;
        selectors[5] = ICloneable.cloneDeterministic.selector;
        selectors[6] = ICloneable.predictDeterministicAddress.selector;
        erc165.setSupportedInterface(type(ICloneable).interfaceId, true);
        return IDiamondCuttable.FacetCut({
            target: address(this),
            action: IDiamondCuttable.FacetCutAction.ADD,
            selectors: selectors
        });
    }
}
