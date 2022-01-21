// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165Storage.sol';
import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import './LibInitializable.sol';

abstract contract DeMineBaseV2 is DiamondBase, Initializable {
    using ERC165Storage for ERC165Storage.Layout;
    using OwnableStorage for OwnableStorage.Layout;

    function __DeMineBaseV2_init(
        address diamond,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        bytes4[] calldata interfaces
    ) internal onlyInitializing {
        OwnableStorage.layout().setOwner(msg.sender);
        (bool success, bytes memory returndata) = diamond.delegatecall(
            abi.encodeWithSelector(
                IDiamondCuttable.diamondCut.selector,
                facetCuts,
                address(0),
                ""
            )
        );
        require(success, string(returndata));

        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        for (uint i; i < interfaces.length; i++) {
            erc165.setSupportedInterface(interfaces[i], true);
        }
    }

    receive() external payable { }
}
