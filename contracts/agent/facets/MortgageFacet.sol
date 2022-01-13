// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../lib/LibERC20Payable.sol';
import '../lib/LibAppStorage.sol';

contract MortgageFacet is PausableModifier, OwnableInternal {
    using LibAppStorage for AppStorage;
    AppStorage internal s;

    event Mortgage(address indexed, uint256, uint256, uint256[]);
    event Redeem(address indexed, address indexed, uint256[], uint256[]);

    modifier onlyMinted(address from) {
        require(
            msg.sender == s.nft && from == address(0),
            'DeMineAgent: only minted tokens from nft contract allowed'
        );
        _;
    }

    function mortgage(
        address mortgager,
        uint256 startCycle,
        uint256 numCycles,
        uint256[] calldata supplies
    ) external onlyOwner {
        require(
            supplies.length == numCycles,
            "DeMine: supply array length mismatch"
        );
        require(
            startCycle > s.rewardingCycle,
            "DeMine: started from rewarded cycle"
        );
        uint256[] memory ids = new uint256[](numCycles);
        for (uint256 i = 0; i < numCycles; i++) {
            uint256 cycle = startCycle + i;
            s.cycles[cycle].supply += supplies[i];
            s.accounts[cycle][mortgager].balance += supplies[i];
            ids[i] = cycle;
        }
        ERC1155WithAgentFacet(s.nft).mintBatch(address(this), ids, supplies);
        emit Mortgage(msg.sender, startCycle, numCycles, tokenPrice);
    }

    function transferMortgage(
        uint256[] calldata ids,
        uint256[] calldata amounts;
        address newMortgager
    ) external whenNotPaused {
        for (uint256 i = 0; i < ids.length; i++) {
            s.decreaseBalance(msg.sender, ids[i], amounts[i]);
            s.accounts[ids[i]][newMortgager] += amounts[i];
        }
        emit TransferMortgage(msg.sender, newMortgager, ids, amounts);
    }

    function redeem(
        address payment,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "PoolOwnerFacet: array length mismatch"
        );
        uint256 tokenCost = s.tokenCost;
        uint256 lastUnbillingCycle = s.lastUnbillingCycle;
        uint256 totalCost;
        for (uint256 i = 0; i < ids.length; i++) {
            require(
                ids[i] >= lastUnbillingCycle,
                'DeMineAgent: token not redeemable'
            );
            totalCost += tokenCost * amounts[i];
            s.decreaseBalance(msg.sender, ids[i], amounts[i]);
        }
        LibERC20Payable.payCustodian(payment, msg.sender, totalCost);
        emit Redeem(msg.sender, payment, ids, amounts);
        ERC1155WithAgentFacet(s.nft).safeBatchTransferFrom(
            address(this),
            msg.sender,
            ids,
            amounts,
            ""
        );
    }

    function onERC1155Received(
        address,
        address from,
        uint256,
        uint256,
        bytes memory data
    ) external onlyMinted(from) override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata,
        uint256[] calldata,
        bytes memory data
    ) external onlyMinted(from) override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
