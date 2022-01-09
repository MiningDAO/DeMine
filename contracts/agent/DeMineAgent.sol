// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';

import './lib/LibDeMineAgent.sol';

contract DeMineAgent is DiamondBase {
    constructor(
        address diamondFacet,
        address agentAdminFacet,
        address poolAdminFacet,
        address externalFacet,
        // AgentAdmin initialization args
        address rewardToken,
        address[] memory payments,
        address custodianChecking,
        address custodianSaving,
        address demineNFT
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
