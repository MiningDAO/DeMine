// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../lib/LibAppStorage.sol';

/**
 * @title: MortgageFacet
 * @author: Shu Dong
 * @notice: Facet contract holding functions for miners to manage mortgage.
 * @dev the contract also implements IERC1155Receiver to receive and lock demine nft
 */
contract MortgageFacet is PausableModifier, OwnableInternal, IERC1155Receiver {
    AppStorage internal s;

    using LibAppStorage for AppStorage;
    using SafeERC20 for IERC20;

    event Mortgage(address indexed, uint256 indexed);
    event Redeem(address indexed, uint256[], uint256[]);

    modifier onlyMinted(address from) {
        require(
            msg.sender == s.nft && from == address(0),
            'DeMineAgent: only minted tokens from nft contract allowed'
        );
        _;
    }

    /**
     * @notice Mortgage your computation power(offline) and mint demine nft.
     *         Minted tokens are locked at DeMineAgent contract.
     * @params address of miner to start the mortgage
     * @params start demine nft id to mint
     * @params end demine nft id to mint
     * @params amount for each token to mint. This also decide amount
     *         of deposit mortgager has to pay
     */
    function mortgage(
        address mortgager,
        uint256 start,
        uint256 end,
        uint256 supply
    ) external onlyOwner {
        require(
            start > s.rewarding,
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
        uint256 deposit = supply * s.tokenCost * s.minDepositDaysRequired;
        IERC20(s.cost).safeTransferFrom(msg.sender, address(this), deposit);
        s.mortgages[mortgageId] = Mortgage(
            msg.sender, start, start + end, supply, deposit
        );
        s.nextMortgage = mortgageId + 1;
        s.nft.mintBatch(address(this), ids, supplies);
        emit Mortgage(msg.sender, mortgageId);
    }

    /**
     * @notice Pay token cost and liquidize tokens
     * @params ids of demine nft token to redeem
     * @params amount of each demine nft token
     */
    function redeem(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "PoolOwnerFacet: array length mismatch"
        );
        uint256 tokenCost = s.tokenCost;
        uint256 billing = s.billing;
        uint256 totalCost;
        for (uint256 i = 0; i < ids.length; i++) {
            require(ids[i] >= billing, 'DeMineAgent: token not redeemable');
            totalCost += tokenCost * amounts[i];
            uint256 balance = s.accounts[ids[i]][msg.sender];
            require(balance > amounts[i], 'DeMineAgent: no sufficient balance');
            s.balances[ids[i]][msg.sender] = balance - amounts[i];
        }
        IERC20(s.cost).safeTransferFrom(msg.sender, address(this), totalCost);
        emit Redeem(msg.sender, ids, amounts);
        s.nft.safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
    }

    /**
     * @notice close finished mortgage, a mortgage can be closed if
     *         the end token has been billed
     * @params mortgage id to close
     */
    function close(uint256 mortgage) external whenNotPaused {
        BillingStorage.Layout storage l = BillingStorage.layout();
        Mortgage memory m = s.mortgages[mortgage];
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
        s.mortgages[mortgage].supply = 0;
        s.mortgages[mortgage].deposit = 0;
    }

    /**
     * @notice get mortgage info
     * @params mortgage id to check
     */
    function getMortgage(uint256 mortgage)
        external
        view
        returns(Mortgage memory)
    {
        return s.mortgages[mortgage];
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

    function min2(uint256 a, uint256 b) private pure {
        return a < b ? a : b;
    }
}
