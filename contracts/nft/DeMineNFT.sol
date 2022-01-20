// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165Storage.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155MetadataStorage.sol';

import '../shared/lib/DeMineBase.sol';
import '../shared/interfaces/IDiamondFacet.sol';
import './interfaces/IERC2981.sol';
import './interfaces/IDeMineNFT.sol';
import './facets/ERC2981Facet.sol';
import './facets/ERC1155MetadataFacet.sol';
import './facets/DeMineNFTFacet.sol';

contract DeMineNFT is DeMineBase {
    using ERC165Storage for ERC165Storage.Layout;

    function initialize(
        address baseFacet,
        address diamondFacet,
        address erc2981Facet,
        address erc1155MetadataFacet,
        address nftFacet,
        // for ERC2981
        address royaltyRecipient,
        uint16 royaltyBps,
        // for ERC1155
        string memory uri
    ) external initializer {
        __DeMineBase_init();
        IDiamondCuttable.FacetCut[] memory facetCuts = new IDiamondCuttable.FacetCut[](5);
        facetCuts[0] = IDiamondFacet(baseFacet).genFacetCutAdd();
        facetCuts[1] = IDiamondFacet(diamondFacet).genFacetCutAdd();
        facetCuts[2] = genCutERC2981(erc2981Facet);
        facetCuts[3] = genCutERC1155Metadata(erc1155MetadataFacet);
        facetCuts[4] = genCutDeMineNFT(nftFacet);
        cutFacets(facetCuts, diamondFacet);

        LibERC2981.layout().recipient = royaltyRecipient;
        LibERC2981.layout().bps = royaltyBps;
        ERC1155MetadataStorage.layout().baseURI = uri;
    }

    function genCutERC2981(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        erc165.setSupportedInterface(type(IERC2981).interfaceId, true);

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = IERC2981.royaltyInfo.selector;
        selectors[1] = ERC2981Facet.setRoyaltyInfo.selector;
        return genFacetCut(target, selectors);
    }

    function genCutERC1155Metadata(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        erc165.setSupportedInterface(type(IERC1155Metadata).interfaceId, true);

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = IERC1155Metadata.uri.selector;
        selectors[1] = ERC1155MetadataFacet.setBaseURI.selector;
        selectors[2] = ERC1155MetadataFacet.setTokenURI.selector;
        return genFacetCut(target, selectors);
    }

    function genCutDeMineNFT(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();

        bytes4[] memory selectors = new bytes4[](13);
        // register ERC1155
        selectors[0] = IERC1155.balanceOf.selector;
        selectors[1] = IERC1155.balanceOfBatch.selector;
        selectors[2] = IERC1155.isApprovedForAll.selector;
        selectors[3] = IERC1155.setApprovalForAll.selector;
        selectors[4] = IERC1155.safeTransferFrom.selector;
        selectors[5] = IERC1155.safeBatchTransferFrom.selector;
        erc165.setSupportedInterface(type(IERC1155).interfaceId, true);

        // register IDeMineNFT
        selectors[6] = IDeMineNFT.alchemize.selector;
        selectors[7] = IDeMineNFT.alchemizeBatch.selector;
        selectors[8] = IDeMineNFT.shrink.selector;
        selectors[9] = IDeMineNFT.getMining.selector;

        // register DeMineNFTFacet
        selectors[10] = DeMineNFTFacet.finalize.selector;
        selectors[11] = DeMineNFTFacet.expand.selector;
        selectors[12] = DeMineNFTFacet.getTokenInfo.selector;

        erc165.setSupportedInterface(type(IDeMineNFT).interfaceId, true);
        return genFacetCut(target, selectors);
    }

    function genCutPoolAgent(
        address target
    ) internal pure returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](5);
        return genFacetCut(target, selectors);
    }
}
