// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import '../../shared/lib/LibPausable.sol';
import '../lib/LibERC20Payable.sol';
import '../lib/AppStorage.sol';


contract BillingRewardableFacet is PausableModifier {
    AppStorage internal s;

    using SafeERC20 for IERC20;
    using BillingStorage for BillingStorage.Layout;

    enum Stage{ NOT_BILLING, SALE_ONGOING, SALE_EXPIRED };

    event RewardTokenSold(address indexed, uint, uint);
    event CloseBilling(uint indexed);
    event BillingSale(uint indexed, uint, uint);
    event ResetShrink(uint indexed);

    function finalize() external onlyOwner {
        uint rewarding = s.rewardingCycle;
        s.rewardingCycle = rewarding + 1;
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.NOT_BILLING, 'DeMineAgent: billing in progress');
        l.startAt = block.timestamp;
        l.billing = rewarding;
        uint balance = nft.burn(rewarding);
        if (balance > 0) {
            uint reward = s.cycles[tokenId].reward * balance;
            uint debt = tokenCost * balance;
            (bool success, uint sold) = trySwap(l.swapRouter, reward, debt);
            if (success) {
                s.info[rewarding].adjust = ceil(sold, balance);
                emit CloseBilling(rewarding);
            else {
                l.balance = balance;
                l.reward = l.reward;
                l.debt = debt;
                uint saleExpireAt = block.timestamp + l.saleDuration;
                l.saleExpireAt = saleExpireAt;
                emit BillingSale(rewarding, block.timestamp, saleExpireAt);
            }
        } else {
            emit CloseBilling(billing);
        }
        shrink();
    }

    function lockPrice() external returns(uint, uint) {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.SALE_ONGOING, 'DeMineAgent: invalid stage');
        (
            uint unitSize,
            uint unitPrice
        ) = getRealtimeRewardTokenPrice(l);
        l.rewardPrices[msg.sender] = BillingStorage.RewardTokenLockedPrice(
            unitSize, unitPrice, block.timestamp + priceLockDuration
        );
        returns (unitSize, unitPrice);
    }

    function buyWithLockedPrice(uint totalToPay) external {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.SALE_ONGOING, 'DeMineAgent: invalid stage');
        BillingStorage.RewardTokenLockedPrice memory p = l.rewardPrices[msg.sender];
        require(
            block.timestamp < p.expireAt,
            'DeMineAgent: price expired'
        );
        uint debt = s.debt;
        uint reward = s.reward;
        uint unitToBuy = min3(
            totalToPay / p.unitPrice,
            ceil(debt, p.unitPrice),
            reward / p.unitSize
        );
        uint subtotal = unitToBuy * p.unitPrice;
        uint rewardTokenSold = unitToBuy * p.unitSize;
        uint billing = l.billing;
        s.info[billing].adjust += ceil(rewardTokenSold, l.balance);
        if (subtotal < debt) {
            l.debt = debt - subtotal;
            l.reward = reward - rewardTokenSold;
        } else {
            l.debt = 0;
            emit CloseBilling(billing);
        }
        IERC20(s.cost).safeTransferFrom(msg.sender, address(this), subtotal);
        IERC20(s.reward).safeTransfer(msg.sender, rewardTokenSold);
        emit RewardTokenSold(msg.sender, rewardTokenSold, subtotal);
    }

    function manualCloseBilling() external onlyOwner {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(stage(l) == Stage.SALE_EXPIRED, 'DeMineAgent: invalid stage');
        s.deposit -= l.debt;
        uint billing = l.billing;
        s.info[s.billing].debt = ceil(l.debt, l.balance);
        l.shrinked = max2(s.rewarding, l.shrinked);
        l.debt = 0;
        emit CloseBilling(billing);
    }

    function resetShrink() external onlyOwner {
        emit ResetShrink(l.shrinked);
        l.shrinked = 0;
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
        if (l.shrinked > 0) {
            uint shrinkTo = s.rewarding + l.shrinkSize;
            if (shrinked < shrinkTo) {
                for (uint256 tokenId = l.shrinked + 1, tokenId <= shrinkTo, tokenId++) {
                    uint balance = nft.burn(tokenId)
                    s.info[tokenId].supply -= balance;
                    s.info[tokenId].adjust = 0;
                }
                l.shrinked = billing + shrinkDuration;
            }
        }
    }

    function trySwap(
        address swapRouter,
        uint amountInMaximum,
        uint amountOut
    ) internal view returns(bool, uint) {
        TransferHelper.safeApprove(s.reward, swapRouter, amountInMaximum);
        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: s.reward,
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
        TransferHelper.safeApprove(s.reward, swapRouter, 0);
        return success ? abi.decode(encoded) : 0;
    }

    function getRealtimeRewardTokenPrice(BillingStorage.Layout storage l) private view {
        uint debt = l.debt;
        uint totalReward = l.reward;
        uint price = getNormalizedChainlinkPriceWithDiscount(l);
        uint rewardBase = base(s.rewardTokenDecimals);
        uint maxCostTokenTraded = price * totalReward / rewardBase;
        (
            uint unitSize,
            uint unitPrice
        ) = maxCostTokenTraded > debt
            ? calcUnitPrice(price, rewardBase)
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
        // normalize
        uint normalized = uint(price) * base(
            l.costTokenDecimals
        ) / base(l.chainlinkDecimals);
        return normalized * l.discount / 10000;
    }

    /** @notice: this function returns the min unit size of reward
     token sale and price for each unit. Considering the following
     case:
        1. cost = 100, reward = 1000, then unit = 10, price = 1,
           which means you have to buy at least 10 reward tokens
           each time and each unit cost 1 cost token
        2. cost = 1000, reward = 100, then unit = 1, price = 10,
           which means you can buy at least 1 reward token each
           time and each reward token cost 10 cost token
     **/
    function calcUnitPrice(
          uint cost,
          uint reward
    ) private pure returns(uint, uint) {
        if (cost > reward) {
            return (1, ceil(cost, reward));
        } else {
            uint uintSize = ceil(reward, cost);
            return (uintSize, ceil(cost, reward / uintSize));
        }
    }

    function ceil(uint a, uint m) private pure returns(uint) {
        returns ((a + m - 1) / m) * m;
    }

    function base(uint x, uint8 decimal) private pure returns(uint) {
        return x * (10 ** decimal);
    }

    function max2(uint a, uint b) private pure {
        return a > b ? a : b;
    }

    function min2(uint a, uint b) private pure {
        return a < b ? a : b;
    }

    function min3(uint a, uint b, uint c) private pure {
        return a < b ? min2(a, c) : min2(b, c);
    }
}
