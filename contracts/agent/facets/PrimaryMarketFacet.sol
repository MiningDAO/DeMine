// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';
import '../interfaces/IPricingStrategy.sol';

/**
 * @title PrimaryMarketFacet
 * @author Shu Dong
 * @notice Facet contract holding functions for primary market sale
 */
contract PrimaryMarketFacet is
    PausableModifier,
    OwnableInternal,
    StorageBase
{
    using SafeERC20 for IERC20;

    event Claim(
        address indexed operator,
        address indexed from,
        address indexed to
    );

    struct ClaimState {
        uint tokenCost;
        uint totalCost;
        uint totalEarned;
    }

    function init(
        uint16 royaltyBps,
        uint royaltyCap,
        address[] calldata pricingStrategies
    ) external onlyOwner {
        setRoyaltyInfo(royaltyBps, royaltyCap);
        for (uint i = 0; i < pricingStrategies.length; i++) {
            s.registeredPricingStrategy[pricingStrategies[i]] = true;
        }
    }

    function registerPricingStrategy(address strategy) external onlyOwner {
        s.registeredPricingStrategy[strategy] = true;
    }

    function isRegisteredPricingStrategy(
        address strategy
    ) external view returns(bool) {
        return s.registeredPricingStrategy[strategy];
    }

    function setPricingStrategy(
        address strategy
    ) external {
        require(
            s.registeredPricingStrategy[strategy],
            'Mining3Agent: pricing strategy not registered'
        );
        s.pricingStrategy[msg.sender] = strategy;
    }

    function pricingStrategy(address account) external view returns(address) {
        return s.pricingStrategy[account];
    }

    function claimFrom(
        address from,
        address to,
        uint[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused returns(uint[] memory) {
        require(
            ids.length == amounts.length,
            "TokenLocker: array length mismatch"
        );
        require(s.approved[from][to], 'Mining3Agent: not approved');
        ClaimState memory cs = ClaimState(s.tokenCost, 0, 0);
        uint[] memory prices = priceOfBatch(from, cs.tokenCost, ids);
        for (uint i = 0; i < ids.length; i++) {
            uint balance = s.balances[ids[i]][from];
            require(
                amounts[i] <= balance,
                'Mining3Agent: insufficient balance'
            );
            unchecked {
                s.balances[ids[i]][from] = balance - amounts[i];
            }
            cs.totalCost += cs.tokenCost * amounts[i];
            cs.totalEarned += (prices[i] - cs.tokenCost) * amounts[i];
        }
        IERC20 payment = IERC20(s.paymentToken);
        uint royalty = royaltyInfo(cs.totalEarned);
        payment.safeTransferFrom(msg.sender, s.custodian, cs.totalCost + royalty);
        payment.safeTransferFrom(msg.sender, from, cs.totalEarned - royalty);
        s.nft.safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
        emit Claim(msg.sender, from, to);
        return amounts;
    }

    function setRoyaltyInfo(
        uint16 royaltyBps,
        uint royaltyCap
    ) public onlyOwner {
        require(
            s.royaltyBps <= 10000 && royaltyCap > 0,
            'Mining3Agent: Invalid royalty bps'
        );
        s.royaltyBps = royaltyBps;
        s.royaltyCap = royaltyCap;
    }

    function royaltyInfo(uint totalEarned) public view returns(uint) {
        uint royalty = (totalEarned * s.royaltyBps) / 10000;
        uint royaltyCap = s.royaltyCap;
        return royalty > royaltyCap ? royaltyCap : royalty;
    }

    function approve(address buyer, bool approval) external {
        s.approved[msg.sender][buyer] = approval;
    }

    function isApproved(
        address owner,
        address buyer
    ) external view returns(bool) {
        return s.approved[owner][buyer];
    }

    function priceOfBatch(
        address owner,
        uint tokenCost,
        uint[] calldata ids
    ) private view returns(uint[] memory) {
        address strategy = s.pricingStrategy[owner];
        require(
            strategy != address(0),
            'Mining3Agent: no strategy set'
        );
        return IPricingStrategy(strategy).priceOfBatch(owner, tokenCost, ids);
    }
}
