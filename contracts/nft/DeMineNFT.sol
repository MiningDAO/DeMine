// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165Storage.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155MetadataStorage.sol';
// use IERC20 from openzeppelin so we can use SafeERC20 lib
import "@openzeppelin/contracts/interfaces/IERC20.sol";

import '../shared/lib/DeMineBase.sol';
import './interfaces/IDeMineNFT.sol';
import './facets/ERC1155Facet.sol';
import './facets/DeMineNFTFacet.sol';
import './lib/AppStorage.sol';

contract DeMineNFT is DeMineBase {
    AppStorage internal s;
    using ERC165Storage for ERC165Storage.Layout;

    function initialize(
        address baseFacet,
        address diamondFacet,
        address erc1155Facet,
        address nftFacet,
        // initialization args
        address income,
        address recipient,
        uint16 bps,
        string memory uri
    ) external initializer {
        __DeMineBase_init();
        IDiamondCuttable.FacetCut[] memory facetCuts = new IDiamondCuttable.FacetCut[](4);
        facetCuts[0] = genCutDeMineBase(baseFacet);
        facetCuts[1] = genCutDiamond(diamondFacet);
        facetCuts[2] = genCutERC1155(erc1155Facet);
        facetCuts[3] = genCutDeMineNFT(nftFacet);
        cutFacets(facetCuts, diamondFacet);

        ERC1155MetadataStorage.layout().baseURI = uri;
        s.royalty = RoyaltyInfo(recipient, bps);
        s.income = IERC20(income);
    }

    function genCutERC1155(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        bytes4[] memory selectors = new bytes4[](11);

        // register ERC1155
        selectors[0] = IERC1155.balanceOf.selector;
        selectors[1] = IERC1155.balanceOfBatch.selector;
        selectors[2] = IERC1155.isApprovedForAll.selector;
        selectors[3] = IERC1155.setApprovalForAll.selector;
        selectors[4] = IERC1155.safeTransferFrom.selector;
        selectors[5] = IERC1155.safeBatchTransferFrom.selector;
        erc165.setSupportedInterface(type(IERC1155).interfaceId, true);

        // register ERC1155Metadata
        selectors[6] = IERC1155Metadata.uri.selector;
        selectors[7] = ERC1155Facet.setBaseURI.selector;
        selectors[8] = ERC1155Facet.setTokenURI.selector;
        erc165.setSupportedInterface(type(IERC1155Metadata).interfaceId, true);

        // register ERC2981
        selectors[9] = IERC2981.royaltyInfo.selector;
        selectors[10] = ERC1155Facet.setRoyaltyInfo.selector;
        erc165.setSupportedInterface(type(IERC2981).interfaceId, true);
        return genFacetCut(target, selectors);
    }

    function genCutDeMineNFT(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        bytes4[] memory selectors = new bytes4[](6);

        // register IDeMineNFT
        selectors[0] = IDeMineNFT.alchemize.selector;
        selectors[1] = IDeMineNFT.shrink.selector;
        selectors[2] = IDeMineNFT.getMining.selector;
        erc165.setSupportedInterface(type(IDeMineNFT).interfaceId, true);

        // register DeMineNFTFacet
        selectors[3] = DeMineNFTFacet.finalize.selector;
        selectors[4] = DeMineNFTFacet.expand.selector;
        selectors[5] = DeMineNFTFacet.getTokenInfo.selector;

        return genFacetCut(target, selectors);
    }
}
