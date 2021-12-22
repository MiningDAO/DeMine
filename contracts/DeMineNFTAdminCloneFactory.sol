// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "./DeMineNFTAdmin.sol";

contract DeMineNFTAdminCloneFactory {
    address immutable implementation;

    constructor() {
        implementation = address(new DeMineNFTAdmin());
    }

    function create(
        uint128 billingPeriod,
        address nft,
        address rewardToken,
        address costToken,
        address costRecipient,
        address owner
    ) external returns(address) {
        address payable cloned = payable(
            ClonesUpgradeable.clone(implementation)
        );
        DeMineNFTAdmin(cloned).initialize(
            billingPeriod,
            nft,
            rewardToken,
            costToken,
            costRecipient
        );
        DeMineNFTAdmin(cloned).transferOwnership(owner);
        return cloned;
    }
}


