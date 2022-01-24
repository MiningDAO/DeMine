// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165Storage.sol';
import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import './LibInitializable.sol';

abstract contract DeMineBase is DiamondBase, Initializable {
    event Clone(address indexed from, address indexed cloned);

    using ERC165Storage for ERC165Storage.Layout;
    using OwnableStorage for OwnableStorage.Layout;

    function __DeMineBase_init(
        address diamond,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        bytes4[] calldata interfaces,
        address owner
    ) internal onlyInitializing {
        // set owner to ensure delegate call works
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
        // set the new owner after initialization
        OwnableStorage.layout().setOwner(owner);
    }

    receive() external payable { }
}
