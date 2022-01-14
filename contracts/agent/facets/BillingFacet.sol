// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import '../../shared/lib/LibPausable.sol';
import '../lib/LibERC20Payable.sol';
import '../lib/AppStorage.sol';
import '../lib/LibBilling.sol';

contract BillingRewardableFacet is PausableModifier, BillingInternal {
    AppStorage internal s;

    using BillingStorage for BillingStorage.Layout;

    event RewardTokenSold(address indexed, uint256, uint256);
    event CloseBilling(uint256 indexed, uint256);
    event AutoSwapTry(uint256 indexed, uint256);

    function retrySwapAndClose() external onlyOwner {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(
            l.pendingCost > 0 && l.auctionExpireAt > l.billingAt,
            'DeMineAgent: auction on-going or no-billing on-going'
        );
        (
            bool success,
            uint256 amountIn
        ) = LibBilling.trySwapAndClose(l.swapRouter, l.lockedReward, l.pendingCost);
        if (success) {
            LibBilling.closeBilling(l, amountIn);
        } else {
            uint256 swapTried = l.numSwapTried + 1;
            l.numSwapTried += swapTried;
            emit AutoSwapTry(billingCycle, swapTried);
        }
    }

    function startRewardTokenAuction() external onlyOwner {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(
            l.pendingCost > 0 &&
                l.numSwapTried > 0 &&
                l.auctionExpireAt < l.billingAt,
            'DeMineAgent: auction not ready'
        );
        l.saleExpireAt = block.timestamp + 12 * 3600;
    }

    function lockPriceForAuction() external returns(uint256, uint256) {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(
            l.isAuctionOngoing(),
            'DeMineAgent: no auction on-going'
        );
        (
            uint256 unitSize,
            uint256 unitPrice
        ) = getRealtimeRewardTokenPrice(l);
        s.lockedPrices[msg.sender] = BillingStorage.RewardTokenLockedPrice(
            unitSize, unitPrice, block.timestamp + priceLockDuration
        );
        returns (unitSize, unitPrice);
    }

    function buyRewardTokenWithLockedPrice(
        address payment,
        uint256 totalToPay
    ) external {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(
            l.isAuctionOngoing(),
            'DeMineAgent: no auction on-going'
        );
        BillingStorage.RewardTokenLockedPrice memory p = s.lockedPrices[msg.sender];
        require(
            block.timestamp < p.expireAt,
            'DeMineAgent: price expired'
        );
        uint256 pendingCost = s.pendingCost;
        uint256 lockedReward = s.lockedReward;
        uint256 unitToBuy = min3(
            totalToPay / p.unitPrice,
            ceil(pendingCost, p.unitPrice),
            lockedReward / p.unitSize
        );
        uint256 subtotal = unitToBuy * p.unitPrice;
        uint256 rewardTokenSold = unitToBuy * p.unitSize;
        uint256 totalRewardSold = l.rewardSold + rewardTokenSold;
        if (subtotal > pendingCost) {
            LibBilling.closeBilling(l, totalRewardSold);
        } else {
            l.pendingCost = pendingCost - subtotal;
            l.lockedReward = lockedReward - rewardTokenSold;
            l.rewardSold = totalRewardSold;
        }
        LibERC20Payable.payCustodian(payment, msg.sender, subtotal);
        IERC20(s.reward).transfer(msg.sender, rewardTokenSold);
        emit RewardTokenSold(msg.sender, rewardTokenSold, subtotal);
    }

    function closeBillingWithDeposit() external onlyOwner {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(
            l.pendingCost > 0 &&
                l.auctionExpireAt > l.billingAt &&
                block.timestamp > l.auctionExpireAt,
            'DeMineAgent: no billing on-going or aution not finished'
        );
        s.deposit -= l.pendingCost;
        s.info[s.billingCycle].debt = ceil(l.pendingCost, l.balance);
        l.shrinkPool = true;
        LibBilling.closeBilling(l, l.rewardSold);
    }

    function shrinkPool(uint256 tokenId) private {
        uint256 balance = nft.burn(tokenId)
        s.info[tokenId].supply -= balance;
        s.info[tokenId].adjustedReward = 0;
    }

    function min2(uint256 a, uint256 b) private pure {
        return a < b ? a : b;
    }

    function min3(uint256 a, uint256 b, uint256 c) private pure {
        return a < b ? min2(a, c) : min2(b, c);
    }

    function getRealtimeRewardTokenPrice(BillingStorage.Layout storage l) public view {
        uint256 totalCost = l.pendingCost;
        uint256 totalReward = l.lockedReward;
        uint256 price = getNormalizedChainlinkPriceWithDiscount(l);
        uint256 rewardBase = base(s.rewardTokenDecimals);
        uint256 maxCostTokenTraded = price * totalReward / rewardBase;
        (
            uint256 unitSize,
            uint256 unitPrice
        ) = maxCostTokenTraded > totalCost
            ? calcAuction(price, rewardBase)
            : calcAuction(totalCost, totalReward);
        return (unitSize, unitPrice);
    }

    function getNormalizedChainlinkPriceWithDiscount(
        BillingStorage.Layout storage l
    ) private returns(uint256) {
        (
            uint80, int price, uint timestamp, uint, uint80
        ) = AggregatorV3Interface(l.chainlink).latestRoundData();
        if (price <= 0) { returns 0; }
        // normalize
        uint256 normalized = uint256(price) * base(
            l.costTokenDecimals
        ) / base(l.chainlinkDecimals);
        return normalized * billingDiscount / 100;
    }

    function calcAuction(
          uint256 cost,
          uint256 reward
    ) private pure returns(uint256, uint256, uint256) {
        if (cost > reward) {
            return (1, ceil(cost, reward));
        } else {
            uint256 uintSize = ceil(reward, cost);
            return (uintSize, ceil(cost, reward / uintSize));
        }
    }

    function ceil(uint a, uint m) private pure returns(uint256) {
        returns ((a + m - 1) / m) * m;
    }

    function base(uint256 x, uint8 decimal) private pure returns(uint256) {
        return x * (10 ** decimal);
    }
}
