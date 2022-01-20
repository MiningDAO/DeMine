// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165Storage.sol';
import '@solidstate/contracts/introspection/IERC165.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBaseStorage.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondLoupe.sol';

import '../interfaces/IPausable.sol';
import '../facets/DiamondFacet.sol';

library LibDiamond {
    using DiamondBaseStorage for DiamondBaseStorage.Layout;
    using ERC165Storage for ERC165Storage.Layout;

    function genCutDiamond(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        bytes4[] memory selectors = new bytes4[](6);

        // register DiamondCuttable
        selectors[0] = IDiamondCuttable.diamondCut.selector;
        erc165.setSupportedInterface(type(IDiamondCuttable).interfaceId, true);

        // register DiamondLoupe
        selectors[1] = IDiamondLoupe.facets.selector;
        selectors[2] = IDiamondLoupe.facetFunctionSelectors.selector;
        selectors[3] = IDiamondLoupe.facetAddresses.selector;
        selectors[4] = IDiamondLoupe.facetAddress.selector;
        erc165.setSupportedInterface(type(IDiamondLoupe).interfaceId, true);

        // register ERC165
        selectors[5] = IERC165.supportsInterface.selector;
        erc165.setSupportedInterface(type(IERC165).interfaceId, true);
        return genFacetCut(target, selectors);
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
}
