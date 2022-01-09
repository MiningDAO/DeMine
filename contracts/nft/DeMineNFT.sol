// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';

import './lib/LibDeMineNFT.sol';

contract DeMineNFT is DiamondBase {
    constructor(
        // facets
        address diamondFacet,
        address erc2981Facet,
        address erc1155MetadataFacet,
        address erc1155WithAgentFacet,
        // for ERC2981
        address royaltyRecipient,
        uint16 royaltyBps,
        // for ERC1155Metadata
        string memory uri,
        // for ERC1155WithAgent
        address demineAgent
    ) {
        LibDeMineNFT.initialize(
            diamondFacet,
            erc2981Facet,
            erc1155MetadataFacet,
            erc1155WithAgentFacet,
            uri,
            royaltyRecipient,
            royaltyBps,
            demineAgent
        );
    }
}
