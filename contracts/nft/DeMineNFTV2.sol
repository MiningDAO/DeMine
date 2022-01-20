// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155MetadataStorage.sol';

import '../shared/lib/DeMineBaseV2.sol';
import './lib/AppStorage.sol';

contract DeMineNFTV2 is DeMineBaseV2 {
    AppStorage internal s;
    using OwnableStorage for OwnableStorage.Layout;

    function initialize(
        address diamond,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        address income,
        address recipient,
        uint16 bps,
        string memory uri
    ) external initializer {
        __DeMineBaseV2_init(diamond, facetCuts);
        ERC1155MetadataStorage.layout().baseURI = uri;
        s.royalty = RoyaltyInfo(recipient, bps);
        s.income = IERC20(income);
        OwnableStorage.layout().setOwner(msg.sender);
    }

    receive() external payable { }
}
