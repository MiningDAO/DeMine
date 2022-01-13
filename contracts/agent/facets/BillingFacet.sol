// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import '../../shared/lib/LibPausable.sol';
import '../lib/LibERC20Payable.sol';
import '../lib/AppStorage.sol';

contract BillingRewardableFacet is PausableModifier {
    event RewardTokenSold(address indexed, uint256 rewardTokenSold, uint256 subtotal);
    event StartBilling(uint256 indexed, uint256, uint256);
    event EndBilling(uint256 indexed, uint256);
    event SkipBilling(uint256 indexed);
    event AutoSwapTry(uint256 indexed, uint256);

    modifier onlyBilling() {
        require(
            s.pendingCost > 0,
            'DeMineAgent: no billing in progress'
        );
        _;
    }

    function billingStart(uint256 billingCycle) external onlyOwner {
        uint256 prevBillingCycle = s.billingCycle;
        require(s.pendingCost == 0, 'DeMineAgent: billing in progress');
        require(
            billingCycle < s.rewardingCycle && billingCycle > prevBillingCycle,
            'DeMineAgent: cycle unrewarded or already paid'
        );
        uint256[] memory balances = ERC1155WithAgentFacet(nft).burnThemAll(
            s.billingCycle + 1,
            billingCycle
        );
        uint256 totalReward;
        uint256 totalCost;
        uint256 tokenCost = s.tokenCost;
        for (uint256 i = 0; i < balances.length; i++) {
            uint256 tokenId = prevBillingCycle + 1 + i;
            totalReward = s.cycles[tokenId].reward * balances[i];
            totalCost = tokenCost * balances[i];
        }
        s.billingCycle = billingCycle;
        if (totalCost > 0) {
            s.lockedReward += totalReward;
            s.pendingCost += totalCost;
            s.saleExpireAt = block.timestamp + 24 * 3600; // one day from now
            s.numAutoSwapTried = 0;
            emit StartBilling(billingCycle, totalReward, totalCost);
        } else {
            emit SkipBilling(billingCycle);
        }
    }

    function billingEnd(
        address payment,
        uint256 cost
    ) external onlyOwner onlyBilling {
        uint256 amountInMaximum = s.lockedReward;
        TransferHelper.safeApprove(s.reward, s.swapRouter, amountInMaximum);
        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: s.reward,
                tokenOut: s.defaultCostToken,
                fee: 3000, // 0.3%
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: s.pendingCost,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
        });
        (bool success, bytes memory encoded) = s.swapRouter.call(
            abi.encodeWithSignature(
                'exactOutputSingle((address,address,uint24,address,uint256,uiint256,uint256,uint160))',
                params
            )
        );
        TransferHelper.safeApprove(s.reward, s.swapRouter, 0);
        if (success) {
            uint256 amountIn = abi.decode(encoded);
            s.pendingCost = 0;
            s.lockedReward = 0;
            uint256 billingCycle = s.billingCycle;
            uint256 totalSoldReward = s.soldReward[billingCycle] + amountIn;
            s.soldReward[billingCycle] = totalSoldReward;
            emit EndBilling(billingCycle, totalSoldReward);
        } else {
            s.numAutoSwapTried += 1;
            emit AutoSwapTry(billingCycle, block.timestamp);
            if (s.numAutoSwapTried > minTryRequiredBeforeManualEnd) {
                billingEndWithDeposit();
            }
        }
    }

    function billingEndWithDeposit() private {
        require(
            s.deposit >= s.pendingCost,
            'DeMineAgent: insufficient deposit'
        );
        uint pendingCost = s.pendingCost;
        uint lockedReward = s.lockedReward;
        s.deposit -= pendingCost;
        s.pendingCost = 0;
        s.lockedReward = 0;
        uint256 billingCycle = s.billingCycle;
        uint256 totalSoldReward = s.soldReward[billingCycle] + s.lockedReward;
        s.soldReward[billingCycle] = totalSoldReward;
        IERC20(s.reward).transferFrom(address(this), operator, lockedReward);
        emit EndBilling(billingCycle, totalSoldReward);
    }

    function lockPrice() external onlyBilling {
        (
            uint256 unitSize,
            uint256 unitPrice
        ) = getRealtimeRewardTokenPrice();
        s.lockedPrices[msg.sender] = AppStorage.RewardTokenLockedPrice(
            unitSize, unitPrice, block.timestamp + priceLockDuration
        );
    }

    function buyRewardTokenWithLockedPrice(
        address payment,
        uint256 totalToPay
    ) external onlyBilling {
        AppStorage.RewardTokenLockedPrice memory p = s.lockedPrices[msg.sender];
        require(
            block.timestamp < s.lockExpireAt && block.timestamp < p.expireAt,
            'DeMineAgent: sale or price expired'
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
        uint billingCycle = s.billingCycle;
        uint totalSoldReward = s.soldReward[billingCycle] + rewardTokenSold;
        s.soldReward[billingCycle] = totalSoldReward;
        if (subtotal > pendingCost) {
            s.pendingCost = 0;
            s.lockedReward = 0;
            emit EndBilling(billingCycle, totalSoldReward);
        } else {
            s.pendingCost = pendingCost - subtotal;
            s.lockedReward = lockedReward - rewardTokenSold;
        }
        LibERC20Payable.payCustodian(payment, msg.sender, subtotal);
        IERC20(s.reward).transfer(msg.sender, rewardTokenSold);
        emit RewardTokenSold(msg.sender, rewardTokenSold, subtotal);
    }

    function min2(uint256 a, uint256 b) private pure {
        return a < b ? a : b;
    }

    function min3(uint256 a, uint256 b, uint256 c) private pure {
        return a < b ? min2(a, c) : min2(b, c);
    }

    function getRealtimeRewardTokenPrice() public view {
        uint256 totalCost = s.pendingCost;
        uint256 totalReward = s.lockedReward;
        uint256 price = getNormalizedChainlinkPriceWithDiscount();
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

    function getNormalizedChainlinkPriceWithDiscount()
        private
        returns(uint256)
    {
        (
            uint80, int price, uint timestamp, uint, uint80
        ) = AggregatorV3Interface(s.chainlink).latestRoundData();
        if (price <= 0) { returns 0; }
        // normalize
        uint256 normalized = uint256(price) * base(
            s.costTokenDecimals
        ) / base(s.chainlinkDecimals);
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
