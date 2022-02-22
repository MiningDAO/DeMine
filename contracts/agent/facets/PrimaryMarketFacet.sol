// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';
import '../interfaces/IPricingStrategy.sol';
import '../interfaces/IAllowanceStrategy.sol';

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
        address[] calldata pricingStrategies,
        address[] calldata allowanceStrategies
    ) external onlyOwner {
        setRoyaltyInfo(royaltyBps, royaltyCap);
        for (uint i = 0; i < pricingStrategies.length; i++) {
            s.strategyRegistry[pricingStrategies[i]] = 1;
        }
        for (uint i = 0; i < allowanceStrategies.length; i++) {
            s.strategyRegistry[allowanceStrategies[i]] = 2;
        }
    }

    function setRoyaltyInfo(
        uint16 royaltyBps,
        uint royaltyCap
    ) public onlyOwner {
        require(s.royaltyBps <= 10000, 'Mining3Agent: Invalid royalty bps');
        s.royaltyBps = royaltyBps;
        s.royaltyCap = royaltyCap;
    }

    function registerStrategy(
        address strategy,
        uint8 strategyType
    ) external onlyOwner {
        s.strategyRegistry[strategy] = strategyType;
    }

    function registeredStrategyType(
        address strategy
    ) external view returns(uint8) {
        return s.strategyRegistry[strategy];
    }

    function setStrategy(address strategy) external {
        uint8 strategyType = s.strategyRegistry[strategy];
        require(
            strategyType > 0,
            'Mining3Agent: strategy not registered'
        );
        s.strategies[msg.sender][strategyType] = strategy;
    }

    function getStrategy(uint8 strategyType) external view returns(address) {
        return s.strategies[msg.sender][strategyType];
    }

    function setPricing(bytes memory args) external {
        address pricing = s.strategies[msg.sender][1];
        require(
            pricing != address(0),
            'Mining3Agent: pricing strategy not set'
        );
        (
            bool success,
            bytes memory result
        ) = pricing.delegatecall(
            abi.encodeWithSelector(
                IPricingStrategy.set.selector,
                msg.sender,
                s.tokenCost,
                args
            )
        );
        require(success, string(result));
    }

    function setAllowance(address buyer, bytes memory args) external {
        address allowance = s.strategies[msg.sender][2];
        require(
            allowance != address(0),
            'Mining3Agent: allowance strategy not set'
        );
        (
            bool success,
            bytes memory result
        ) = allowance.delegatecall(
            abi.encodeWithSelector(
                IAllowanceStrategy.set.selector,
                msg.sender,
                buyer,
                args
            )
        );
        require(success, string(result));
    }

    function claimFrom(
        address from,
        address to,
        uint[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused returns(uint[] memory) {
        require(
            to == msg.sender || to == address(0),
            'Mining3Agent: invalid operator'
        );
        require(
            ids.length == amounts.length,
            "TokenLocker: array length mismatch"
        );
        checkAllowances(from, to, ids, amounts);
        uint[] memory prices = priceOfBatch(from, ids);
        ClaimState memory cs = ClaimState(s.tokenCost, 0, 0);
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

    function royaltyInfo(uint totalEarned) public view returns(uint) {
        uint royalty = (totalEarned * s.royaltyBps) / 10000;
        uint royaltyCap = s.royaltyCap;
        return royaltyCap > 0 && royalty > royaltyCap ? royaltyCap : royalty;
    }

    function priceOfBatch(
        address account,
        uint[] calldata ids
    ) public view returns(uint[] memory prices) {
        address pricing = s.strategies[account][1];
        require(pricing != address(0), 'Mining3Agent: pricing not set');
        (
            bool success,
            bytes memory result
        ) = pricing.staticcall(
            abi.encodeWithSelector(
                IPricingStrategy.priceOfBatch.selector,
                msg.sender,
                ids
            )
        );
        require(success, string(result));
        prices = abi.decode(result, (uint[]));
    }

    function allowanceOfBatch(
        address owner,
        address buyer,
        uint[] calldata ids
    ) external view returns(uint[] memory allowances) {
        address allowance = s.strategies[owner][2];
        require(
            allowance != address(0),
            'Mining3Agent: allowance strategy not set'
        );
        (
            bool success,
            bytes memory result
        ) = allowance.staticcall(
            abi.encodeWithSelector(
                IAllowanceStrategy.allowanceOfBatch.selector,
                owner,
                buyer,
                ids
            )
        );
        require(success, string(result));
        allowances = abi.decode(result, (uint[]));
    }

    function checkAllowances(
        address owner,
        address buyer,
        uint[] calldata ids,
        uint[] calldata amounts
    ) private {
        address allowance = s.strategies[owner][2];
        require(
            allowance != address(0),
            'Mining3Agent: allowance strategy not set'
        );
        (
            bool success,
            bytes memory result
        ) = allowance.delegatecall(
            abi.encodeWithSelector(
                IAllowanceStrategy.checkAllowances.selector,
                owner,
                buyer,
                ids,
                amounts
            )
        );
        require(success, string(result));
    }
}
