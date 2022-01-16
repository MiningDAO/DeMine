// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';

import './lib/LibDeMineAgent.sol';

contract DeMineAgent is DiamondBase {
    constructor(
        address diamondFacet,
        address mortgageFacet,
        address primaryMarketFacet,
        address paycheckFacet,
        address billingFacet,
        // AgentAdmin initialization args
        uint256 tokenCost,
        address income,
        address cost,
        address demineNFT
    ) {
        LibDeMineAgent.initialize(
            diamondFacet,
            mortgageFacet,
            primaryMarketFacet,
            paycheckFacet,
            billingFacet,
            tokenCost,
            income,
            cost,
            demineNFT
        );
    }
}
