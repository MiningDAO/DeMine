// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155MetadataStorage.sol';
import "@openzeppelin/contracts/proxy/Clones.sol";

import '../shared/lib/DeMineBase.sol';
import './lib/AppStorage.sol';

contract DeMineNFT is DeMineBase {
    AppStorage internal s;

    function initialize(
        address diamondFacet,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        bytes4[] calldata interfaces,
        address income,
        address recipient,
        uint16 bps,
        string memory uri,
        address owner
    ) external initializer {
        __DeMineBase_init(diamondFacet, facetCuts, interfaces, owner);
        ERC1155MetadataStorage.layout().baseURI = uri;
        s.royalty = RoyaltyInfo(recipient, bps);
        s.income = IERC20(income);
    }

    function create(
        address diamondFacet,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        bytes4[] calldata interfaces,
        address income,
        address recipient,
        uint16 bps,
        string memory uri,
        address owner
    ) external {
        address cloned = Clones.clone(address(this));
        DeMineNFT(payable(cloned)).initialize(
            diamondFacet, facetCuts, interfaces, income, recipient, bps, uri, owner
        );
        emit Clone(address(this), cloned);
    }
}
