// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';

import './lib/LibDeMineAgent.sol';

contract DeMineAgent is DiamondBase {
    constructor(
        address demineNFT,
        address diamondFacet,
        address agentAdminFacet,
        address poolAdminFacet,
        address externalFacet
    ) {
        LibDeMineAgent.initialize(
            demineNFT,
            diamondFacet,
            agentAdminFacet,
            poolAdminFacet,
            externalFacet
        );
    }
}
