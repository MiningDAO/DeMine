// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/Util.sol';
import '../lib/AppStorage.sol';

/**
 * @title: BillingFacet
 * @author: Shu Dong
 * @notice: billing related functions
 */
contract BillingFacet is PausableModifier {
    AppStorage internal s;

    using SafeERC20 for IERC20;
    using BillingStorage for BillingStorage.Layout;

    enum Stage{ NOT_BILLING, SALE_ONGOING, SALE_EXPIRED };

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
        uint mining = s.mining;
        s.mining = mining + 1;
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.NOT_BILLING, 'DeMineAgent: billing in progress');
        l.startAt = block.timestamp;
        s.billing = mining;
        uint balance = nft.burn(mining);
        if (balance > 0) {
            uint income = s.cycles[tokenId].income * balance;
            uint debt = tokenCost * balance;
            (bool success, uint sold) = trySwap(l.swapRouter, income, debt);
            if (success) {
                s.info[mining].adjust = Util.ceil(sold, balance);
                emit CloseBilling(mining);
            else {
                l.balance = balance;
                l.income = l.income;
                l.debt = debt;
                uint saleExpireAt = block.timestamp + l.saleDuration;
                l.saleExpireAt = saleExpireAt;
                emit BillingSale(mining, block.timestamp, saleExpireAt);
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
        l.incomePrices[msg.sender] = BillingStorage.RewardTokenLockedPrice(
            unitSize, unitPrice, block.timestamp + priceLockDuration
        );
        returns (unitSize, unitPrice);
    }

    /**
     * @notice buy income token with locked price
     * @params max amount of cost to pay
     */
    function buyWithLockedPrice(uint maxToPay) external {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.SALE_ONGOING, 'DeMineAgent: invalid stage');
        BillingStorage.RewardTokenLockedPrice memory p = l.incomePrices[msg.sender];
        require(
            block.timestamp < p.expireAt,
            'DeMineAgent: price expired'
        );
        uint debt = s.debt;
        uint income = s.income;
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
     */
    function withdrawAfterBilling(uint256[] calldata ids) external whenNotPaused {
        BillingStorage.Layout storage l = BillingStorage.layout();
        uint256 totalReward;
        uint256 totalDebt;
        for (uint i = 0; i < ids.length; i++) {
            require(ids[i] <= s.billing, 'DeMineAgent: not billed yet');
            uint256 balance = s.balances[ids[i]][msg.sender];
            totalReward += s.info[ids[i]].adjustedReward * balance;
            totalDebt += s.info[ids[i]].debt * balance;
            s.balances[ids[i]][msg.sender] = 0;
        }
        s.cost.safeTransferFrom(msg.sender, address(this), totalDebt);
        s.income.safeTransfer(msg.sender, totalReward);
    }

    function stage(BillingStorage.Layout storage l) private view {
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
                for (uint256 tokenId = s.shrinked + 1, tokenId <= shrinkTo, tokenId++) {
                    uint balance = nft.burn(tokenId)
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
    ) internal view returns(bool, uint) {
        TransferHelper.safeApprove(s.income, swapRouter, amountInMaximum);
        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: s.income,
                tokenOut: s.defaultCostToken,
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
                params
            )
        );
        TransferHelper.safeApprove(s.income, swapRouter, 0);
        return success ? abi.decode(encoded) : 0;
    }

    function getRealtimeRewardTokenPrice(BillingStorage.Layout storage l) private view {
        uint debt = l.debt;
        uint totalReward = l.income;
        uint price = getNormalizedChainlinkPriceWithDiscount(l);
        uint incomeBase = base(s.income.decimals());
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
        (
            uint80, int price, uint timestamp, uint, uint80
        ) = AggregatorV3Interface(l.chainlink).latestRoundData();
        if (price <= 0) { returns 0; }
        uint normalized = uint(price) * base(
            s.cost.decimals()
        ) / base(l.chainklink.decimals());
        return normalized * l.discount / 10000;
    }

    /** @notice: this function returns the min unit size of income
     token sale and price for each unit. Considering the following
     case:
        1. cost = 100, income = 1000, then unit = 10, price = 1,
           which means you have to buy at least 10 income tokens
           each time and each unit cost 1 cost token
        2. cost = 1000, income = 100, then unit = 1, price = 10,
           which means you can buy at least 1 income token each
           time and each income token cost 10 cost token
     **/
    function calcUnitPrice(
          uint cost,
          uint income
    ) private pure returns(uint, uint) {
        if (cost > income) {
            return (1, Util.ceil(cost, income));
        } else {
            uint uintSize = Util.ceil(income, cost);
            return (uintSize, Util.ceil(cost, income / uintSize));
        }
    }
}
