// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./DeMineNFT.sol";
import "./DeMineAgent.sol";

contract DeMineCloneFactory {
    event Clone(address indexed, address indexed);

    address immutable nftImpl;
    address immutable agentImpl;

    constructor() {
        nftImpl = address(new DeMineNFT());
        agentImpl = address(new DeMineAgent());
    }

    function create(
        // nft
        string memory uri,
        address royaltyRecipient,
        uint16 royaltyBps,
        address rewardToken,
        // agent
        address[] memory payments,
        address custodian,
        // owner
        address owner
    ) external returns(address, address) {
        address nftCloned = Clones.clone(nftImpl);
        address agentCloned = Clones.clone(agentImpl);
        DeMineNFT(nftCloned).initialize(
            uri,
            royaltyRecipient,
            royaltyBps,
            rewardToken,
            agentCloned
        );
        DeMineAgent(agentCloned).initialize(
            payments,
            custodian,
            nftCloned
        );
        DeMineNFT(nftCloned).transferOwnership(owner);
        DeMineAgent(agentCloned).transferOwnership(owner);
        emit Clone(nftCloned, agentCloned);
        return (nftCloned, agentCloned);
    }
}
