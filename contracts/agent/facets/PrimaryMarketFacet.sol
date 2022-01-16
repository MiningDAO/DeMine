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
     * @param ids DeMine nft token ids to increase allowance
     * @param amounts Amount to increase per token
     */
    function increaseAllowance(
        address target,
        uint[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "PoolOwnerFacet: array length mismatch"
        );
        for (uint i = 0; i < ids.length; i++) {
            s.allowances[target][target][ids[i]] += amounts[i];
        }
        emit IncreaseAllowance(msg.sender, target, ids, amounts);
    }

    /**
     * @notice decrease allowance of target for msg.sender
     * @param target Address of target user
     * @param ids DeMine nft token ids to decrease allowance
     * @param amounts Amount to decrease per token
     */
    function decreaseAllowance(
        address target,
        uint[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "DeMineNFTMetadata: array length mismatch"
        );
        for (uint i = 0; i < ids.length; i++) {
            uint allowance = s.allowances[msg.sender][target][ids[i]];
            require(
                allowance >= amounts[i],
                "DeMineAgent: allowance will below zero"
            );
            s.allowances[msg.sender][target][ids[i]] = allowance - amounts[i];
        }
        emit DecreaseAllowance(msg.sender, target, ids, amounts);
    }

    /**
     * @notice claim tokens listed for msg.sender from DeMineAgent
     * @param from Address of demine nft issuer
     * @param ids DeMine nft token ids to buy
     * @param maxAmounts The max amount to buy per token, the amount of
     *        final bought token could be less than this per allowance
     *        and balance state
     */
    function claim(
        address from,
        uint[] calldata ids,
        uint[] calldata maxAmounts
    ) external whenNotPaused returns(uint[] memory) {
        require(
            ids.length == maxAmounts.length,
            "TokenLocker: array length mismatch"
        );
        PricingStorage.Layout storage l = PricingStorage.layout();
        function(
            PricingStorage.Layout storage,
            address,
            uint
        ) internal view returns(uint) priceF;
        PricingStorage.PricingStrategy strategy = l.strategy[from];
        if (strategy == PricingStorage.PricingStrategy.STATIC) {
            priceF = LibPricingStatic.priceOf;
        } else if (strategy == PricingStorage.PricingStrategy.LINEAR_DECAY) {
            priceF = LibPricingLinearDecay.priceOf;
        }
        uint tokenCost = s.tokenCost;
        uint billing = s.billing;
        uint totalToPay;
        uint totalCost;
        uint[] memory ids = new uint[](ids.length);
        uint[] memory amounts = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            require(ids[i] > billing, 'DeMineAgent: billing token');
            uint amount = checkBalance(from, ids[i], maxAmounts[i]);
            amount = checkAllowance(s.allowances[from], ids[i], amount);
            amounts[i] = amount;
            totalCost += tokenCost * amount;
        }
        s.cost.safeTransferFrom(msg.sender, address(this), totalCost);
        s.cost.safeTransferFrom(msg.sender, from, totalToPay - totalCost);
        s.nft.safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
        emit Claim(msg.sender, from, ids, amounts);
    }

    function checkBalance(address from, uint id, uint amount) private returns(uint) {
        uint balance = s.balances[id][from];
        uint amount = Util.min2(balance, amount);
        s.balances[id][from] = balance - amount;
        return amount;
    }

    function checkAllowance(
        mapping(address => mapping(uint => uint)) storage allowances,
        uint id,
        uint amount
    ) private returns(uint) {
        uint allowance1 = allowances[msg.sender][id];
        uint allowance2 = allowances[address(0)][id];
        uint maxAllowed = allowance1 + allowance2;
        require(maxAllowed >= amount, 'DeMineAgent: insufficient allowance');
        if (amount <= allowance1) {
            allowances[msg.sender][id] -= amount;
            return amount;
        } else if (amount <= maxAllowed) {
            allowances[msg.sender][id] = 0;
            allowances[address(0)][id] = amount - allowance1;
            return amount;
        } else if (amount > maxAllowed) {
            allowances[msg.sender][id] = 0;
            allowances[address(0)][id] = 0;
            return maxAllowed;
        }
    }

    /**
     * @notice get listed prices of demine nft
     * @param from Address of demine nft issuer
     * @param ids DeMine nft token ids to check
     * @return list of prices for each token
     */
    function getListedPrices(
        address from,
        uint[] calldata ids
    ) external view returns(uint[] memory) {
        PricingStorage.Layout storage l = PricingStorage.layout();
        function(
            PricingStorage.Layout storage,
            address,
            uint
        ) internal view returns(uint) priceF;
        PricingStorage.PricingStrategy strategy = l.strategy[from];
        if (strategy == PricingStorage.PricingStrategy.STATIC) {
            priceF = LibPricingStatic.priceOf;
        } else if (strategy == PricingStorage.PricingStrategy.LINEAR_DECAY) {
            priceF = LibPricingLinearDecay.priceOf;
        }
        uint[] memory prices = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            prices[i] = priceF(l, from, ids[i]);
        }
        return prices;
    }

    /**
     * @notice get allowance information
     * @param from Address of demine nft issuer
     * @param target Address of target address
     * @param ids DeMine nft token ids to check
     */
    function getAllowances(
        address from,
        address target,
        uint[] calldata ids
    ) external view returns(uint[] memory) {
        uint[] memory result = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            result[i] = s.allowances[from][target][ids[i]];
        }
        return result;
    }
}
