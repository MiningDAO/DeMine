// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import './LibInitializable.sol';

abstract contract DeMineBaseV2 is DiamondBase, Initializable {
    function __DeMineBaseV2_init(
        address diamond,
        IDiamondCuttable.FacetCut[] calldata facetCuts
    ) internal onlyInitializing {
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
}
