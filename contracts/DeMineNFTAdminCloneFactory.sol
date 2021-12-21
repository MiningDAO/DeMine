// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "./DeMineNFTAdmin.sol";

contract DeMineNFTAdminCloneFactory {
    address immutable implementation;

    constructor() {
        implementation = address(new DeMineNFTAdmin());
    }

    function create(
        string memory uri,
        uint16 royaltyBps,
        address nftFactory,
        address rewardToken,
        address costToken,
        address costRecipient,
        uint128 billingPeriod
    ) external returns(address) {
        address payable cloned = payable(
            ClonesUpgradeable.clone(implementation)
        );
        DeMineNFTAdmin(cloned).initialize(
            uri,
            royaltyBps,
            nftFactory,
            rewardToken,
            costToken,
            costRecipient,
            billingPeriod
        );
        DeMineNFTAdmin(cloned).transferOwnership(msg.sender);
        return cloned;
    }
}


