// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import './LibInitializable.sol';

abstract contract DeMineBase is DiamondBase, Initializable {
    using OwnableStorage for OwnableStorage.Layout;

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

    receive() external payable { }
}
