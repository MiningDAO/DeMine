// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/SafeOwnable.sol';
import { IERC173 } from '@solidstate/contracts/access/IERC173.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
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
        bytes4[] memory selectors = new bytes4[](15);

        // register DiamondCuttable
        selectors[0] = IDiamondCuttable.diamondCut.selector;
        erc165.setSupportedInterface(type(IDiamondCuttable).interfaceId, true);

        // register DiamondLoupe
        selectors[1] = IDiamondLoupe.facets.selector;
        selectors[2] = IDiamondLoupe.facetFunctionSelectors.selector;
        selectors[3] = IDiamondLoupe.facetAddresses.selector;
        selectors[4] = IDiamondLoupe.facetAddress.selector;
        erc165.setSupportedInterface(type(IDiamondLoupe).interfaceId, true);

        // register SafeOwnable
        selectors[5] = Ownable.owner.selector;
        selectors[6] = SafeOwnable.nomineeOwner.selector;
        selectors[7] = SafeOwnable.transferOwnership.selector;
        selectors[8] = SafeOwnable.acceptOwnership.selector;
        erc165.setSupportedInterface(type(IERC173).interfaceId, true);

        // register Pausable
        selectors[9] = IPausable.paused.selector;
        selectors[10] = IPausable.pause.selector;
        selectors[11] = IPausable.unpause.selector;
        erc165.setSupportedInterface(type(IPausable).interfaceId, true);

        // register ERC165
        selectors[12] = IERC165.supportsInterface.selector;
        erc165.setSupportedInterface(type(IERC165).interfaceId, true);

        // register Diamond
        selectors[13] = DiamondFacet.getFallbackAddress.selector;
        selectors[14] = DiamondFacet.setFallbackAddress.selector;

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
