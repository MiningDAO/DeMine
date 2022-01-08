// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';

import './lib/LibDeMineNFT.sol';

contract DeMineNFT is DiamondBase {
    constructor(
        address demineAgent,
        address diamondFacet,
        address erc2981Facet,
        address erc1155MetadataFacet,
        address erc1155WithAgentFacet
    ) {
        LibDeMineNFT.initialize(
            demineAgent,
            diamondFacet,
            erc2981Facet,
            erc1155MetadataFacet,
            erc1155WithAgentFacet
        );
    }
}
