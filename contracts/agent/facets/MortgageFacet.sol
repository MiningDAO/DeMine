// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../../shared/lib/Util.sol';

/**
 * @title MortgageFacet
 * @author Shu Dong
 * @notice Facet contract holding functions for miners to manage mortgage.
 * @dev the contract also implements IERC1155Receiver to receive and lock demine nft
 */
contract MortgageFacet is
    PausableModifier,
    OwnableInternal,
    IERC1155Receiver,
    ERC165
{
    AppStorage internal s;

    using SafeERC20 for IERC20;

    event NewMortgage(address indexed, uint indexed);
    event Redeem(address indexed, uint[], uint[]);

    modifier onlyMinted(address from) {
        require(
            msg.sender == address(s.nft) && from == address(0),
            'DeMineAgent: only minted tokens from nft contract allowed'
        );
        _;
    }

    /**
     * @notice Mortgage your computation power(offline) and mint demine nft.
     *         Minted tokens are locked at DeMineAgent contract.
     * @param mortgager Address of miner owning this mortgage
     * @param start DeMine nft id to mint
     * @param end DeMine nft id to mint
     * @param supply Amount for each token to mint. This also decide
     *        amount of deposit mortgager has to pay
     */
    function mortgage(
        address mortgager,
        uint start,
        uint end,
        uint supply
    ) external onlyOwner returns(uint mortgageId) {
        require(
            start > s.mining && start > s.shrinked,
            'DeMine: token mined already or shrinked'
        );
        uint numCycles = end - start + 1;
        uint[] memory ids = new uint[](numCycles);
        uint[] memory supplies = new uint[](numCycles);
        for (uint i = 0; i < numCycles; i++) {
            uint id = start + i;
            s.info[id].supply += supplies[i];
            s.balances[id][mortgager] += supplies[i];
            ids[i] = id;
            supplies[i] = supply;
        }
        mortgageId = s.mortgage;
        uint deposit = supply * s.tokenCost * s.minDepositDaysRequired;
        s.cost.safeTransferFrom(msg.sender, address(this), deposit);
        s.mortgages[mortgageId] = Mortgage(
            msg.sender, start, start + end, supply, deposit
        );
        s.deposit += deposit;
        s.mortgage = mortgageId + 1;
        s.nft.mintBatch(address(this), ids, supplies);
        emit NewMortgage(msg.sender, mortgageId);
    }

    /**
     * @notice Pay token cost and liquidize tokens
     * @param ids DeMine nft token ids to redeem
     * @param amounts Amount of each demine nft token
     */
    function redeem(
        uint[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "PoolOwnerFacet: array length mismatch"
        );
        uint tokenCost = s.tokenCost;
        uint billing = s.billing;
        uint totalCost;
        for (uint i = 0; i < ids.length; i++) {
            require(ids[i] >= billing, 'DeMineAgent: token not redeemable');
            totalCost += tokenCost * amounts[i];
            uint balance = s.balances[ids[i]][msg.sender];
            require(balance > amounts[i], 'DeMineAgent: no sufficient balance');
            s.balances[ids[i]][msg.sender] = balance - amounts[i];
        }
        s.cost.safeTransferFrom(msg.sender, address(this), totalCost);
        emit Redeem(msg.sender, ids, amounts);
        s.nft.safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
    }

    /**
     * @notice close finished mortgage, a mortgage can be closed if
     *         the all tokens are billed or liquidized
     * @param mortgageId The mortgage id returned by mortgage function
     */
    function close(uint mortgageId) external whenNotPaused {
        Mortgage memory m = s.mortgages[mortgageId];
        uint totalReward;
        uint totalDebt;
        for (uint i = 0; i < m.end - m.start + 1; i ++) {
            uint id = i + m.start;
            uint balance = s.balances[id][msg.sender];
            if (balance > 0) {
                require(id < s.billing, 'DeMineAgent: unliqudized token');
                TokenInfo memory info = s.info[id];
                uint min = Util.min2(balance, m.supply);
                totalReward += (info.income - info.adjust) * min;
                totalDebt += info.debt * min;
                s.balances[id][msg.sender] = balance - min;
            }
        }
        s.cost.safeTransferFrom(msg.sender, address(this), m.deposit - totalDebt);
        s.income.safeTransfer(msg.sender, totalReward);
        s.mortgages[mortgageId].supply = 0;
        s.mortgages[mortgageId].deposit = 0;
    }

    /**
     * @notice get mortgage info
     * @param mortgageId The mortgage id returned by mortgage function
     */
    function getMortgage(uint mortgageId)
        external
        view
        returns(Mortgage memory)
    {
        return s.mortgages[mortgageId];
    }

    function onERC1155Received(
        address,
        address from,
        uint,
        uint,
        bytes memory
    ) external view onlyMinted(from) override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint[] calldata,
        uint[] calldata,
        bytes memory
    ) external view onlyMinted(from) override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
