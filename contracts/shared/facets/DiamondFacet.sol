// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/DiamondBaseStorage.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/proxy/diamond/DiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/DiamondLoupe.sol';

import '../interfaces/IDiamondFacet.sol';

contract DiamondFacet is IDiamondFacet, DiamondCuttable, DiamondLoupe, ERC165 {
    using ERC165Storage for ERC165Storage.Layout;

    function getFallbackAddress() external view returns (address) {
        return DiamondBaseStorage.layout().fallbackAddress;
    }

    function setFallbackAddress(address fallbackAddress) external onlyOwner {
        DiamondBaseStorage.layout().fallbackAddress = fallbackAddress;
    }

    function genFacetCutAdd()
        external
        override
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
            target: address(this),
            action: IDiamondCuttable.FacetCutAction.ADD,
            selectors: selectors
        });
    }
}
