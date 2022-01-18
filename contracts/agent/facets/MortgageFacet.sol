// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/Util.sol';
import '../../shared/lib/LibPausable.sol';
import '../interfaces/IMortgage.sol';
import '../lib/AppStorage.sol';

/**
 * @title MortgageFacet
 * @author Shu Dong
 * @notice Facet contract holding functions for miners to manage mortgage.
 * @dev the contract also implements IERC1155Receiver to receive and lock demine nft
 */
contract MortgageFacet is
    IMortgage,
    PausableModifier,
    OwnableInternal,
    ERC165
{
    AppStorage internal s;

    using SafeERC20 for IERC20;

    event NewMortgage(address indexed, uint indexed);
    event Redeem(address indexed, uint[], uint[]);

    modifier onlyNFT() {
        require(
            msg.sender == s.nft,
            'DeMineAgent: only nft contract allowed'
        );
        _;
    }

    /**
     * @notice Mortgage your computation power(offline) and mint demine nft.
     * Minted tokens are locked at DeMineAgent contract.
     * @param start DeMine nft id to mint
     * @param end DeMine nft id to mint
     * @param supply Amount for each token to mint. This also decide
     * amount of deposit mortgager has to pay
     * @param data Extra data with mortgager address encoded
     */
    function mortgage(
        uint128 start,
        uint128 end,
        uint supply,
        bytes memory data
    ) external onlyNFT returns(uint mortgageId) {
        require(
            start > s.mining && start > s.shrinked,
            'DeMine: token mined already or shrinked'
        );
        (address mortgager) = abi.decode(data, (address));
        for (uint128 cycle = start; i <= end; i++) {
            s.balances[cycle][mortgager] += supply;
        }
        mortgageId = s.mortgageId;
        uint deposit = supply * s.tokenCost * s.minDepositDaysRequired;
        s.cost.safeTransferFrom(msg.sender, address(this), deposit);
        s.mortgages[mortgageId] = Mortgage(
            msg.sender, start, end, supply, deposit
        );
        s.deposit += deposit;
        s.mortgageId = mortgageId + 1;
        emit NewMortgage(msg.sender, mortgageId);
    }

    /**
     * @notice Pay token cost and liquidize tokens
     * @param cycles DeMine nft token cycles to redeem
     * @param amounts Amount of each demine nft token
     */
    function redeem(
        uint128[] calldata cycles,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            cycles.length == amounts.length,
            "PoolOwnerFacet: array length mismatch"
        );
        uint tokenCost = s.tokenCost;
        uint128 billing = s.billing;
        uint totalCost;
        for (uint i = 0; i < cycles.length; i++) {
            require(cycles[i] >= billing, 'DeMineAgent: token not redeemable');
            totalCost += tokenCost * amounts[i];
            uint balance = s.balances[cycles[i]][msg.sender];
            require(balance > amounts[i], 'DeMineAgent: no sufficient balance');
            s.balances[cycles[i]][msg.sender] = balance - amounts[i];
        }
        s.cost.safeTransferFrom(msg.sender, address(this), totalCost);
        emit Redeem(msg.sender, cycles, amounts);
        IERC1155(s.nft).safeBatchTransferFrom(address(this), msg.sender, cycles, amounts, "");
    }

    /**
     * @notice close finished mortgage, a mortgage can be closed if
     *         the all tokens are billed or liquidized
     * @param mortgageId The mortgage id returned by mortgage function
     */
    function close(uint128 mortgageId) external whenNotPaused {
        Mortgage memory m = s.mortgages[mortgageId];
        uint totalReward;
        uint totalDebt;
        for (uint128 i = 0; i < m.end - m.start + 1; i ++) {
            uint128 cycle = i + m.start;
            uint balance = s.balances[cycle][msg.sender];
            if (balance > 0) {
                require(cycle < s.billing, 'DeMineAgent: unliqudized token');
                Cycle memory c = s.cycles[cycle];
                uint min = Util.min2(balance, m.supply);
                totalReward += (c.income - c.adjust) * min;
                totalDebt += c.debt * min;
                s.balances[cycle][msg.sender] = balance - min;
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
    function getMortgage(uint128 mortgageId)
        external
        view
        returns(Mortgage memory)
    {
        return s.mortgages[mortgageId];
    }
}
