// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/Util.sol';
import '../lib/pricing/LibPricingStatic.sol';
import '../lib/pricing/LibPricingLinearDecay.sol';

/**
 * @title PrimaryMarketFacet
 * @author Shu Dong
 * @notice Facet contract holding functions for primary market sale
 */
contract PrimaryMarketFacet is PausableModifier, PricingStatic, PricingLinearDecay {
    AppStorage internal s;

    using SafeERC20 for IERC20;

    event Claim(address indexed, address indexed, uint[], uint[]);
    event IncreaseAllowance(
        address indexed,
        address indexed,
        uint[],
        uint[]
    );
    event DecreaseAllowance(
        address indexed,
        address indexed,
        uint[],
        uint[]
    );

    struct ClaimMetadata {
        uint128 billing;
        uint tokenCost;
        uint totalCost;
        uint totalPay;
    }

    /**
     * @notice set pricing strategy for msg.sender
     * @param strategy pricing strategy to set, currently STATIC and LINEAR_DECAY are supported
     * @param args Arguments of pricing strategy set
     */
    function setPricingStrategy(
        PricingStorage.PricingStrategy strategy,
        bytes memory args
    ) external {
        PricingStorage.Layout storage l = PricingStorage.layout();
        l.strategy[msg.sender] = strategy;
        if (strategy == PricingStorage.PricingStrategy.STATIC) {
            LibPricingStatic.initialize(l, s.tokenCost, msg.sender, args);
        } else if (strategy == PricingStorage.PricingStrategy.LINEAR_DECAY) {
            LibPricingLinearDecay.initialize(l, s.tokenCost, msg.sender, args);
        }
    }

    /**
     * @notice increase allowance of target for msg.sender
     * @param target Address of target user
     * @param cycles DeMine nft token cycles to increase allowance
     * @param amounts Amount to increase per token
     */
    function increaseAllowance(
        address target,
        uint128[] calldata cycles,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            cycles.length == amounts.length,
            "PoolOwnerFacet: array length mismatch"
        );
        for (uint i = 0; i < cycles.length; i++) {
            s.allowances[target][target][cycles[i]] += amounts[i];
        }
        emit IncreaseAllowance(msg.sender, target, cycles, amounts);
    }

    /**
     * @notice decrease allowance of target for msg.sender
     * @param target Address of target user
     * @param cycles DeMine nft token cycles to decrease allowance
     * @param amounts Amount to decrease per token
     */
    function decreaseAllowance(
        address target,
        uint128[] calldata cycles,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            cycles.length == amounts.length,
            "DeMineNFTMetadata: array length mismatch"
        );
        for (uint i = 0; i < cycles.length; i++) {
            uint allowance = s.allowances[msg.sender][target][cycles[i]];
            require(
                allowance >= amounts[i],
                "DeMineAgent: allowance will below zero"
            );
            s.allowances[msg.sender][target][cycles[i]] = allowance - amounts[i];
        }
        emit DecreaseAllowance(msg.sender, target, cycles, amounts);
    }

    /**
     * @notice claim tokens listed for msg.sender from DeMineAgent
     * @param from Address of demine nft issuer
     * @param cycles DeMine nft token cycles to buy
     * @param maxAmounts The max amount to buy per token, the amount of
     *        final bought token could be less than this per allowance
     *        and balance state
     */
    function claim(
        address from,
        uint128[] calldata cycles,
        uint[] calldata maxAmounts
    ) external whenNotPaused returns(uint[] memory) {
        require(
            cycles.length == maxAmounts.length,
            "TokenLocker: array length mismatch"
        );
        ClaimMetadata memory m = ClaimMetadata(s.billing, s.tokenCost, 0, 0);
        PricingStorage.Layout storage l = PricingStorage.layout();
        function(
            PricingStorage.Layout storage,
            address,
            uint
        ) internal view returns(uint) f = priceF(l.strategy[from]);
        uint[] memory amounts = new uint[](cycles.length);
        for (uint i = 0; i < cycles.length; i++) {
            require(cycles[i] > m.billing, 'DeMineAgent: billing token');
            uint amount = maxAllowed(from, cycles[i], maxAmounts[i]);
            amounts[i] = amount;
            m.totalCost += m.tokenCost * amount;
            m.totalPay += f(l, from, cycles[i]) * amount;
        }
        s.cost.safeTransferFrom(msg.sender, address(this), m.totalCost);
        s.cost.safeTransferFrom(msg.sender, from, m.totalPay - m.totalCost);
        s.nft.safeBatchTransferFrom(address(this), msg.sender, cycles, amounts, "");
        emit Claim(msg.sender, from, cycles, amounts);
        return amounts;
    }

    /**
     * @notice get listed prices of demine nft
     * @param from Address of demine nft issuer
     * @param cycles DeMine nft token cycles to check
     * @return list of prices for each token
     */
    function getListedPrices(
        address from,
        uint128[] calldata cycles
    ) external view returns(uint[] memory) {
        PricingStorage.Layout storage l = PricingStorage.layout();
        function(
            PricingStorage.Layout storage,
            address,
            uint
        ) internal view returns(uint) f = priceF(l.strategy[from]);
        uint[] memory prices = new uint[](cycles.length);
        for (uint i = 0; i < cycles.length; i++) {
            prices[i] = f(l, from, cycles[i]);
        }
        return prices;
    }

    /**
     * @notice get allowance information
     * @param from Address of demine nft issuer
     * @param target Address of target address
     * @param cycles DeMine nft token cycles to check
     */
    function getAllowances(
        address from,
        address target,
        uint128[] calldata cycles
    ) external view returns(uint[] memory) {
        uint[] memory result = new uint[](cycles.length);
        for (uint i = 0; i < cycles.length; i++) {
            result[i] = s.allowances[from][target][cycles[i]];
        }
        return result;
    }

    function maxAllowed(address from, uint128 cycle, uint amount) private returns(uint) {
        uint balance = s.balances[cycle][from];
        amount = Util.min2(balance, amount);
        amount = checkAllowance(from, cycle, amount);
        s.balances[cycle][from] = balance - amount;
        return amount;
    }

    function checkAllowance(address from, uint128 cycle, uint amount) private returns(uint) {
        uint allowance1 = s.allowances[from][msg.sender][cycle];
        uint allowance2 = s.allowances[from][address(0)][cycle];
        uint allowed = allowance1 + allowance2;
        if (amount <= allowance1) {
            s.allowances[from][msg.sender][cycle] -= amount;
            return amount;
        } else if (amount <= allowed) {
            s.allowances[from][msg.sender][cycle] = 0;
            s.allowances[from][address(0)][cycle] = amount - allowance1;
            return amount;
        } else {
            s.allowances[from][msg.sender][cycle] = 0;
            s.allowances[from][address(0)][cycle] = 0;
            return allowed;
        }
    }

    function priceF(
        PricingStorage.PricingStrategy strategy
    ) private pure returns(
        function(
            PricingStorage.Layout storage,
            address,
            uint
        ) internal view returns(uint) f
    ) {
        if (strategy == PricingStorage.PricingStrategy.STATIC) {
            f = LibPricingStatic.priceOf;
        } else if (strategy == PricingStorage.PricingStrategy.LINEAR_DECAY) {
            f = LibPricingLinearDecay.priceOf;
        }
    }
}
