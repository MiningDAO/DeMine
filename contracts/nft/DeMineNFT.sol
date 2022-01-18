// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155MetadataStorage.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondLoupe.sol';

import '../shared/lib/LibDiamond.sol';
import './interfaces/IERC2981.sol';
import './interfaces/IDeMineNFT.sol';
import './interfaces/IPoolAgent.sol';
import './lib/LibERC2981.sol';
import './facets/ERC2981Facet.sol';
import './facets/ERC1155MetadataFacet.sol';
import './facets/PoolAgentFacet.sol';

contract DeMineNFT is DiamondBase {
    using DiamondBaseStorage for DiamondBaseStorage.Layout;
    using LibERC1155WithAgent for LibERC1155WithAgent.Layout;
    using OwnableStorage for OwnableStorage.Layout;
    using ERC165Storage for ERC165Storage.Layout;

    constructor(
        // facets
        address diamondFacet,
        address erc2981Facet,
        address erc1155MetadataFacet,
        address nftFacet,
        address poolAgentFacet,
        // for ERC2981
        address royaltyRecipient,
        uint16 royaltyBps,
        // for ERC1155Metadata
        string memory uri
    ) {
        OwnableStorage.layout().setOwner(msg.sender);

        IDiamondCuttable.FacetCut[] memory facetCuts = new IDiamondCuttable.FacetCut[](5);
        facetCuts[0] = LibDiamond.genCutDiamond(diamondFacet);
        facetCuts[1] = genCutERC2981(erc2981Facet);
        facetCuts[2] = genCutERC1155Metadata(erc1155MetadataFacet);
        facetCuts[3] = genCutDeMineNFT(nftFacet);
        facetCuts[4] = genCutPoolAgent(poolAgentFacet);
        (bool success, bytes memory returndata) = diamondFacet.delegatecall(
            abi.encodeWithSelector(
                IDiamondCuttable.diamondCut.selector,
                facetCuts,
                address(0),
                ""
            )
        );

        LibERC2981.layout().recipient = royaltyRecipient;
        LibERC2981.layout().bps = royaltyBps;
        ERC1155MetadataStorage.layout().baseURI = uri;
        require(success, string(returndata));
    }

    function genCutERC2981(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        erc165.setSupportedInterface(type(IERC2981).interfaceId, true);

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = IERC2981.royaltyInfo.selector;
        selectors[1] = ERC2981Facet.setRoyaltyInfo.selector;
        return LibDiamond.genFacetCut(target, selectors);
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
        return LibDiamond.genFacetCut(target, selectors);
    }

    function genCutDeMineNFT(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();

        bytes4[] memory selectors = new bytes4[](10);
        // register ERC1155
        selectors[0] = IERC1155.balanceOf.selector;
        selectors[1] = IERC1155.balanceOfBatch.selector;
        selectors[2] = IERC1155.isApprovedForAll.selector;
        selectors[3] = IERC1155.setApprovalForAll.selector;
        selectors[4] = IERC1155.safeTransferFrom.selector;
        selectors[5] = IERC1155.safeBatchTransferFrom.selector;
        erc165.setSupportedInterface(type(IERC1155).interfaceId, true);

        // register ERC1155WithAgent
        selectors[6] = IDeMineNFT.alchemize.selector;
        selectors[7] = IDeMineNFT.alchemizeBatch.selector;
        selectors[8] = IDeMineNFT.getMining.selector;
        selectors[9] = IDeMineNFT.getCycle.selector;
        erc165.setSupportedInterface(type(IDeMineNFT).interfaceId, true);
        return LibDiamond.genFacetCut(target, selectors);
    }

    function genCutPoolAgent(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();

        bytes4[] memory selectors = new bytes4[](6);
        // register IPoolAgent
        selectors[0] = IPoolAgent.mintBatch.selector;
        selectors[1] = IPoolAgent.shrink.selector;
        erc165.setSupportedInterface(type(IPoolAgent).interfaceId, true);

        // register PoolAgent
        selectors[2] = PoolAgentFacet.registerPool.selector;
        selectors[3] = PoolAgentFacet.finalizeCycle.selector;
        selectors[4] = PoolAgentFacet.getAgent.selector;
        selectors[5] = PoolAgentFacet.getPool.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }
}
