// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/Util.sol';
import '../lib/AppStorage.sol';
import '../lib/BillingStorage.sol';

/**
 * @title BillingFacet
 * @author Shu Dong
 * @notice billing related functions
 */
contract BillingFacet is PausableModifier, OwnableInternal {
    AppStorage internal s;

    using SafeERC20 for IERC20;

    enum Stage{ NO_BILLING, SALE_ONGOING, SALE_EXPIRED }

    event RewardTokenSold(address indexed, uint, uint);
    event CloseBilling(uint indexed);
    event BillingSale(uint indexed, uint, uint);
    event ResetShrink(uint indexed);

    /**
     * @notice finalize the mining cycle and pay bill.
     *         It will try to sell income token at Uniswap
     *         and start an income token sale if it fails
     */
    function finalize() external onlyOwner {
        uint billing = s.mining;
        s.mining = billing + 1;
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.NO_BILLING, 'DeMineAgent: billing in progress');
        l.startAt = block.timestamp;
        s.billing = billing;
        uint balance = s.nft.burn(billing);
        if (balance > 0) {
            uint income = s.info[billing].income * balance;
            uint debt = s.tokenCost * balance;
            (bool success, uint sold) = trySwap(l.swapRouter, income, debt);
            if (success) {
                s.info[billing].adjust = Util.ceil(sold, balance);
                emit CloseBilling(billing);
            } else {
                l.balance = balance;
                l.income = l.income;
                l.debt = debt;
                uint saleExpireAt = block.timestamp + l.saleDuration;
                l.saleExpireAt = saleExpireAt;
                emit BillingSale(billing, block.timestamp, saleExpireAt);
            }
        } else {
            emit CloseBilling(billing);
        }
        shrink();
    }

    /**
     * @notice lock price to buy income token in income token sale
     */
    function lockPrice() external returns(uint, uint) {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.SALE_ONGOING, 'DeMineAgent: invalid stage');
        (
            uint unitSize,
            uint unitPrice
        ) = getRealtimeRewardTokenPrice(l);
        l.lockedPrices[msg.sender] = BillingStorage.LockedPrice(
            unitSize, unitPrice, block.timestamp + l.priceLockDuration
        );
        return (unitSize, unitPrice);
    }

    /**
     * @notice buy income token with locked price
     * @param maxToPay The max amount of cost to pay
     */
    function buyWithLockedPrice(uint maxToPay) external {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.SALE_ONGOING, 'DeMineAgent: invalid stage');
        BillingStorage.LockedPrice memory p = l.lockedPrices[msg.sender];
        require(
            block.timestamp < p.expireAt,
            'DeMineAgent: price expired'
        );
        uint debt = l.debt;
        uint income = l.income;
        uint unitToBuy = Util.min3(
            maxToPay / p.unitPrice,
            Util.ceil(debt, p.unitPrice),
            income / p.unitSize
        );
        uint subtotal = unitToBuy * p.unitPrice;
        uint incomeTokenSold = unitToBuy * p.unitSize;
        uint billing = s.billing;
        s.info[billing].adjust += Util.ceil(incomeTokenSold, l.balance);
        if (subtotal < debt) {
            l.debt = debt - subtotal;
            l.income = income - incomeTokenSold;
        } else {
            l.debt = 0;
            emit CloseBilling(billing);
        }
        s.cost.safeTransferFrom(msg.sender, address(this), subtotal);
        s.income.safeTransfer(msg.sender, incomeTokenSold);
        emit RewardTokenSold(msg.sender, incomeTokenSold, subtotal);
    }

    /**
     * @notice manually close the billing by paying cost with user deposit.
     *         In this case, the pool will be shrinked since current mining
     *         token.
     */
    function manualCloseBilling() external onlyOwner {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.SALE_EXPIRED, 'DeMineAgent: invalid stage');
        s.deposit -= l.debt;
        uint billing = s.billing;
        s.info[s.billing].debt = Util.ceil(l.debt, l.balance);
        l.debt = 0;
        if (s.shrinked == 0) {
            s.shrinked = s.mining;
            shrink();
        }
        emit CloseBilling(billing);
    }

    /**
     * @notice disable shrink. Token already shrinked will not be affected
     */
    function resetShrink() external onlyOwner {
        emit ResetShrink(s.shrinked);
        s.shrinked = 0;
    }

    /**
     * @notice withdraw income and pay debt for tokens already billed
     * @param ids DeMine NFT ids to withdraw
     */
    function withdrawAfterBilling(uint256[] calldata ids) external whenNotPaused {
        BillingStorage.Layout storage l = BillingStorage.layout();
        uint256 totalReward;
        uint256 totalDebt;
        for (uint i = 0; i < ids.length; i++) {
            require(ids[i] <= s.billing, 'DeMineAgent: not billed yet');
            uint256 balance = s.balances[ids[i]][msg.sender];
            TokenInfo memory info = s.info[ids[i]];
            totalReward += (info.income - info.adjust) * balance;
            totalDebt += info.debt * balance;
            s.balances[ids[i]][msg.sender] = 0;
        }
        s.cost.safeTransferFrom(msg.sender, address(this), totalDebt);
        s.income.safeTransfer(msg.sender, totalReward);
    }

    function stage(BillingStorage.Layout storage l) private view returns(Stage) {
        if (l.debt == 0) {
            return Stage.NO_BILLING;
        } else if (block.timestamp < l.saleExpireAt) {
            return Stage.SALE_ONGOING;
        } else {
            return Stage.SALE_EXPIRED;
        }
    }

    function shrink() private {
        uint shrinked = s.shrinked;
        if (shrinked > 0) {
            uint shrinkTo = s.mining + s.shrinkSize;
            if (shrinked < shrinkTo) {
                for (uint256 tokenId = s.shrinked + 1; tokenId <= shrinkTo; tokenId++) {
                    uint balance = s.nft.burn(tokenId);
                    s.info[tokenId].supply -= balance;
                    s.info[tokenId].adjust = 0;
                }
                s.shrinked = shrinkTo;
            }
        }
    }

    function trySwap(
        address swapRouter,
        uint amountInMaximum,
        uint amountOut
    ) internal returns(bool, uint) {
        TransferHelper.safeApprove(address(s.income), swapRouter, amountInMaximum);
        ISwapRouter.ExactOutputSingleParams memory param =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: address(s.income),
                tokenOut: address(s.cost),
                fee: 3000, // 0.3%
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
        });
        (bool success, bytes memory encoded) = swapRouter.call(
            abi.encodeWithSignature(
                'exactOutputSingle((address,address,uint24,address,uint,uiint256,uint,uint160))',
                param
            )
        );
        TransferHelper.safeApprove(address(s.income), swapRouter, 0);
        if (success) {
            (uint amountIn) = abi.decode(encoded, (uint));
            return (true, amountIn);
        } else {
            return (false, 0);
        }
    }

    function getRealtimeRewardTokenPrice(
        BillingStorage.Layout storage l
    ) private returns(uint, uint) {
        uint debt = l.debt;
        uint totalReward = l.income;
        uint price = getNormalizedChainlinkPriceWithDiscount(l);
        uint incomeBase = base(s.income);
        uint maxCostTokenTraded = price * totalReward / incomeBase;
        (
            uint unitSize,
            uint unitPrice
        ) = maxCostTokenTraded > debt
            ? calcUnitPrice(price, incomeBase)
            : calcUnitPrice(debt, totalReward);
        return (unitSize, unitPrice);
    }

    function getNormalizedChainlinkPriceWithDiscount(
        BillingStorage.Layout storage l
    ) private returns(uint) {
        (,int price, , ,) = l.chainlink.latestRoundData();
        if (price <= 0) { return 0; }
        uint chainlinkBase = 10 ** (l.chainlink.decimals());
        uint normalized = uint(price) * base(s.cost) / chainlinkBase;
        return normalized * l.discount / 10000;
    }

    function base(IERC20 token) private returns(uint) {
        uint8 decimals = IERC20Metadata(address(token)).decimals();
        return 10 ** decimals;
    }

    function calcUnitPrice(
          uint cost,
          uint income
    ) private pure returns(uint, uint) {
        if (cost > income) {
            /**
              cost = 100, income = 1000, then unit = 10, price = 1,
              which means you have to buy at least 10 income tokens
              each time and each unit cost 1 cost token
            */
            return (1, Util.ceil(cost, income));
        } else {
            /**
              cost = 1000, income = 100, then unit = 1, price = 10,
              which means you can buy at least 1 income token each
              time and each income token cost 10 cost token
            */
            uint unitSize = Util.ceil(income, cost);
            return (unitSize, Util.ceil(cost, income / unitSize));
        }
    }
}
