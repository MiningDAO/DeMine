// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/Util.sol';
import '../lib/LibAppStorage.sol';
import '../lib/PricingStatic.sol';
import '../lib/PricingLinearDecay.sol';

/**
 * @title: PrimaryMarketFacet
 * @author: Shu Dong
 * @notice: Facet contract holding functions for primary market sale
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
     * @params pricing strategy to set, currently STATIC and LINEAR_DECAY are supported
     * @params arguments of pricing strategy set
     */
    function setPricingStrategy(
        AppStorage.PricingStrategy ps,
        bytes memory args
    ) external {
        PricingStorage.Layout storage l = PricingStorage.layout();
        l.settings[msg.sender].pricingStrategy = ps;
        LibPricing.initialize(l, s, msg.sender, args);
    }

    /**
     * @notice increase allowance of target for msg.sender
     * @params address of target user
     * @params demine nft token ids to increase allowance
     * @params amount to increase per token
     */
    function increaseAllowance(
        address target,
        uint128[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "PoolOwnerFacet: array length mismatch"
        );
        for (uint i = 0; i < ids.length; i++) {
            s.allowances[mortgager][target][ids[i]] += amounts[i];
        }
        emit IncreaseAllowance(msg.sender, target, ids, amounts;
    }

    /**
     * @notice decrease allowance of target for msg.sender
     * @params address of target user
     * @params demine nft token ids to decrease allowance
     * @params amount to decrease per token
     */
    function decreaseAllowance(
        address target,
        uint128[] calldata ids,
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
            s.allowances[from][target][ids[i]] = allowance - amounts[i];
        }
        emit DecreaseAllowance(msg.sender, target, ids, amounts);
    }

    /**
     * @notice claim tokens listed for msg.sender from DeMineAgent
     * @params address of demine nft issuer
     * @params demine nft token ids to buy
     * @params max amount to buy per token, the amount of final bought token
     *         could be less than this per allowance and balance state
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
        ) internal view returns(uint) priceF = LibPricing.priceOfFunc(l);
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
            s.locked[cycle][pool] -= amount;
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
            s.allowances[mortgager][msg.sender][id] -= amount;
            return amount;
        } else if (amount <= maxAllowed) {
            s.allowances[mortgager][msg.sender][id] = 0;
            s.allowances[mortgager][address(0)][id] = amount - allowance1;
            return amount;
        } else if (amount > maxAllowed) {
            s.allowances[mortgager][msg.sender][id] = 0;
            s.allowances[mortgager][address(0)][id] = 0;
            return maxAllowed;
        }
    }

    /**
     * @notice get listed prices of demine nft
     * @params address of demine nft issuer
     * @params demine nft token ids to check
     */
    function getListedPrices(
        address from,
        uint[] calldata ids
    ) external view override returns(uint[] memory) {
        PricingStorage.Layout storage l = PricingStorage.layout();
        function(
            PricingStorage.Layout storage,
            address,
            uint
        ) internal view returns(uint) priceF = LibPricing.priceOfFunc(l);
        uint[] memory prices = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            prices[i] = priceF(l, from, ids[i]);
        }
        return prices;
    }

    /**
     * @notice get allowance information
     * @params address of demine nft issuer
     * @params address of target address
     * @params demine nft token ids to check
     */
    function getAllowances(
        address from,
        address buyer,
        uint[] calldata ids
    ) external view returns(uint[] memory) {
        uint[] memory result = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            result[i] = s.allowances[from][buyer][ids[i]];
        }
        return result;
    }
}
