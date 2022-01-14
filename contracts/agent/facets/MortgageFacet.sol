// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../lib/LibAppStorage.sol';

contract MortgageFacet is PausableModifier, OwnableInternal {
    AppStorage internal s;

    using LibAppStorage for AppStorage;
    using SafeERC20 for IERC20;

    event Mortgage(address indexed, uint256 indexed);
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
        uint256 start,
        uint256 end,
        uint256 supplies
    ) external onlyOwner {
        require(
            start > s.rewardingCycle,
            "DeMine: started from rewarded cycle"
        );
        uint256 numCycles = end - start + 1;
        uint256[] memory ids = new uint256[](numCycles);
        uint256[] memory supplies = new uint256[](numCycles);
        for (uint256 i = 0; i < numCycles; i++) {
            uint256 cycle = start + i;
            s.cycles[cycle].supply += supplies[i];
            s.accounts[cycle][mortgager].balance += supplies[i];
            ids[i] = cycle;
            supplies[i] = supplies;
        }
        uint256 mortgageId = s.nextMortgage;
        uint256 deposit = supply * s.tokenCost * s.depositCycles;
        IERC20(s.cost).safeTransferFrom(msg.sender, address(this), deposit);
        s.mortgage[mortgageId] = Mortgage(
            msg.sender, start, start + end, supply, deposit
        );
        s.nextMortgage = mortgageId + 1;
        ERC1155WithAgentFacet(s.nft).mintBatch(address(this), ids, supplies);
        emit Mortgage(msg.sender, mortgageId);
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
        IERC20(s.cost).safeTransferFrom(msg.sender, address(this), totalCost);
        emit Redeem(msg.sender, , ids, amounts);
        ERC1155WithAgentFacet(s.nft).safeBatchTransferFrom(
            address(this),
            msg.sender,
            ids,
            amounts,
            ""
        );
    }

    function withdraw(uint256[] calldata ids) external whenNotPaused {
        uint256 totalReward;
        uint256 totalDebt;
        for (uint i = 0; i < ids.length; i++) {
            uint256 balance = s.balances[ids[i]][msg.sender];
            totalReward += s.info[ids[i]].adjustedReward * balance;
            totalDebt += s.info[ids[i]].debt * balance;
            s.balances[ids[i]][msg.sender] = 0;
        }
        IERC20(s.cost).safeTransferFrom(msg.sender, address(this), totalDebt);
        IERC20(s.reward).safeTransfer(msg.sender, totalReward);
    }

    function clearMortgage(uint256 mortgage) external whenNotPaused {
        BillingStorage.Layout storage l = BillingStorage.layout();
        Mortgage memory m = s.mortgage[mortgage];
        require(
            m.end < l.billingCycle,
            'DeMineAgent: mortgage not finished yet'
        );
        uint256 totalReward;
        uint256 totalDebt;
        for (uint i = 0; i < m.end - m.start + 1; i ++) {
            uint256 id = i + m.start;
            uint256 total = s.balances[id][msg.sender];
            uint256 balance = min2(total, m.supply);
            totalReward += s.info[id]].adjustedReward * balance;
            totalDebt += s.info[id].debt * balance;
            s.balances[id][msg.sender] = total - balance;
        }
        uint256 deposit = m.deposit - totalDebt;
        IERC20(s.cost).safeTransferFrom(msg.sender, address(this), m.deposit - totalDebt);
        IERC20(s.reward).safeTransfer(msg.sender, totalReward);
        s.mortgage[mortgage].supply = 0;
        s.mortgage[mortgage].deposit = 0;
    }

    function min2(uint256 a, uint256 b) private pure {
        return a < b ? a : b;
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
