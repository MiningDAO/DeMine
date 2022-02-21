// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';
import '../interfaces/IPricing.sol';
import '../interfaces/IAllowance.sol';

/**
 * @title PrimaryMarketFacet
 * @author Shu Dong
 * @notice Facet contract holding functions for primary market sale
 */
contract PrimaryMarketFacet is PausableModifier, OwnableInternal, StorageBase {
    using SafeERC20 for IERC20;

    event SetAllowance(
        address indexed,
        address indexed,
        uint[],
        uint[]
    );

    struct ClaimState {
        uint tokenCost;
        uint totalCost;
        uint totalPay;
    }

    function setPricingStrategyImpl(
        address impl,
        bool valid
    ) external onlyOwner {
        s.supportedPricingStrategies[impl] = valid;
    }

    function isSupportedPricingStrategy(
        address impl
    ) external view returns(bool) {
        return s.supportedPricingStrategies[impl];
    }

    function setAllowanceStrategyImpl(
        address impl,
        bool valid
    ) external onlyOwner {
        s.supportedAllowanceStrategies[impl] = valid;
    }

    function isSupportedAllowanceStrategy(
        address impl
    ) external view returns(bool) {
        return s.supportedAllowanceStrategies[impl];
    }

    function setPricingStrategy(address impl) external {
        require(
            s.supportedPricingStrategies[impl],
            'Mining3Agent: not supported pricing'
        );
        s.pricingStategy[msg.sender] = impl;
    }

    function getPricingStrategy() external view returns(address) {
        return s.pricingStategy[msg.sender];
    }

    function setPricing(bytes memory args) external {
        address pricing = s.pricingStategy[msg.sender];
        require(pricing != address(0), 'Mining3Agent: pricing not set');
        (
            bool success,
            bytes memory result
        ) = pricing.delegatecall(
            abi.encodeWithSelector(
                IPricing.set.selector,
                msg.sender,
                s.tokenCost,
                args
            )
        );
        require(success, string(result));
    }

    function setAllowanceStrategy(address impl) external {
        require(
            s.supportedAllowanceStrategies[impl],
            'Mining3Agent: not supported allowance strategy'
        );
        s.allowanceStrategy[msg.sender] = impl;
    }

    function getAllowanceStrategy() external view returns(address) {
        return s.allowanceStrategy[msg.sender];
    }

    function setAllowance(address buyer, bytes memory args) external {
        address allowance = s.pricingStategy[msg.sender];
        require(allowance != address(0), 'Mining3Agent: pricing not set');
        (
            bool success,
            bytes memory result
        ) = allowance.delegatecall(
            abi.encodeWithSelector(
                IAllowance.set.selector,
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
        uint[] memory prices = priceOfBatch(from, ids);
        uint[] memory allowances = allowanceOfBatch(from, to, ids);
        ClaimState memory cs = ClaimState(s.tokenCost, 0, 0);
        for (uint i = 0; i < ids.length; i++) {
            require(
                amounts[i] <= allowances[i],
                'Mining3Agent: insufficinet allowance'
            );
            uint balance = s.balances[ids[i]][from];
            require(
                amounts[i] <= balance,
                'Mining3Agent: insufficient balance'
            );
            unchecked {
                s.balances[ids[i]][from] = balance - amounts[i];
            }
            cs.totalCost += cs.tokenCost * amounts[i];
            cs.totalPay += prices[i] * amounts[i];
        }
        IERC20 payment = IERC20(s.paymentToken);
        payment.safeTransferFrom(msg.sender, s.custodian, cs.totalCost);
        payment.safeTransferFrom(msg.sender, from, cs.totalPay - cs.totalCost);
        s.nft.safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
        return amounts;
    }

    function priceOfBatch(
        address account,
        uint[] calldata ids
    ) public view returns(uint[] memory prices) {
        address pricing = s.pricingStategy[account];
        require(pricing != address(0), 'Mining3Agent: pricing not set');
        (
            bool success,
            bytes memory result
        ) = pricing.staticcall(
            abi.encodeWithSelector(
                IPricing.priceOfBatch.selector,
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
    ) public view returns(uint[] memory allowances) {
        address allowance = s.allowanceStrategy[owner];
        require(allowance != address(0), 'Mining3Agent: pricing not set');
        (
            bool success,
            bytes memory result
        ) = allowance.staticcall(
            abi.encodeWithSelector(
                IAllowance.allowanceOfBatch.selector,
                owner,
                buyer,
                ids
            )
        );
        require(success, string(result));
        allowances = abi.decode(result, (uint[]));
    }
}
