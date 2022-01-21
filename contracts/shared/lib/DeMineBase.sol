// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/introspection/ERC165Storage.sol';
import '@solidstate/contracts/access/SafeOwnable.sol';
import { IERC173 } from '@solidstate/contracts/access/IERC173.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';

import '../interfaces/IPausable.sol';
import '../interfaces/ICloneable.sol';
import '../facets/DiamondFacet.sol';
import './LibInitializable.sol';

abstract contract DeMineBase is DiamondBase, Initializable {
    using OwnableStorage for OwnableStorage.Layout;
    using ERC165Storage for ERC165Storage.Layout;

    function __DeMineBase_init() internal onlyInitializing {
        OwnableStorage.layout().setOwner(msg.sender);
    }

    function genFacetCut(
        address target,
        bytes4[] memory selectors
    ) internal pure returns(IDiamondCuttable.FacetCut memory) {
        return IDiamondCuttable.FacetCut({
            target: target,
            action: IDiamondCuttable.FacetCutAction.ADD,
            selectors: selectors
        });
    }

    function cutFacets(
        IDiamondCuttable.FacetCut[] memory facetCuts,
        address diamond
    ) internal {
        (bool success, bytes memory returndata) = diamond.delegatecall(
            abi.encodeWithSelector(
                IDiamondCuttable.diamondCut.selector,
                facetCuts,
                address(0),
                ""
            )
        );
        require(success, string(returndata));
    }

    function genCutDeMineBase(address target)
        internal
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
            target: target,
            action: IDiamondCuttable.FacetCutAction.ADD,
            selectors: selectors
        });
    }

    function genCutDiamond(address target)
        internal
        returns(IDiamondCuttable.FacetCut memory)
    {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        bytes4[] memory selectors = new bytes4[](8);

        // register DiamondCuttable
        selectors[0] = IDiamondCuttable.diamondCut.selector;
        erc165.setSupportedInterface(type(IDiamondCuttable).interfaceId, true);

        // register DiamondLoupe
        selectors[1] = IDiamondLoupe.facets.selector;
        selectors[2] = IDiamondLoupe.facetFunctionSelectors.selector;
        selectors[3] = IDiamondLoupe.facetAddresses.selector;
        selectors[4] = IDiamondLoupe.facetAddress.selector;
        erc165.setSupportedInterface(type(IDiamondLoupe).interfaceId, true);

        // register DiamondFacet
        selectors[5] = DiamondFacet.getFallbackAddress.selector;
        selectors[6] = DiamondFacet.setFallbackAddress.selector;

        // register ERC165
        selectors[7] = IERC165.supportsInterface.selector;
        erc165.setSupportedInterface(type(IERC165).interfaceId, true);
        return IDiamondCuttable.FacetCut({
            target: target,
            action: IDiamondCuttable.FacetCutAction.ADD,
            selectors: selectors
        });
    }

    receive() external payable { }
}
