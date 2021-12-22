// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "./DeMineNFT.sol";

contract DeMineNFTCloneFactory {
    address immutable implementation;

    constructor() {
        implementation = address(new DeMineNFT());
    }

    function create(
        string memory uri,
        address royaltyRecipient,
        uint16 royaltyBps,
        address owner
    ) external returns(address) {
        address cloned = ClonesUpgradeable.clone(implementation);
        DeMineNFT(cloned).initialize(
            uri,
            royaltyRecipient,
            royaltyBps
        );
        DeMineNFT(cloned).transferOwnership(owner);
        return cloned;
    }
}


