// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

import '../lib/AppStorage.sol';
import '../lib/BillingStorage.sol';

library LibBilling {
    function billing(AppStorage storage s, uint256 billingCycle) internal {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(
            l.pendingCost == 0 && billingCycle < s.rewardingCycle
            'DeMineAgent: billing in progress or cycle unrewarded'
        );
        l.billingAt = block.timestamp;
        l.billingCycle = billingCycle;
        uint256 balance = nft.burn(billingCycle);
        if (balance > 0) {
            uint256 reward = s.cycles[tokenId].reward * balance;
            uint256 cost = tokenCost * balance;
            (bool success, uint256 sold) = _trySwapAndClose(l.swapRouter, reward, cost);
            if (success) {
                closeBilling(l, amountIn);
            else {
                l.balance = balance;
                l.lockedReward = reward;
                l.pendingCost = cost;
                l.numSwapTried = 1;
                emit AutoSwapTry(billingCycle, 1);
            }
        } else {
            closeBilling(l, 0);
        }
    }

    function closeBilling(
        BillingStorage.Layout storage l,
        uint256 totalRewardSold
    ) internal {
        uint256 billingCycle = l.billingCycle;
        s.info[billingCycle].adjustedReward = (
            l.lockedReward - totalRewardSold
        ) / l.balance;
        l.pendingCost = 0;
        l.lockedReward = 0;
        if (l.shrinkPool = true) {
            shrinkPool(s.rewardingCycle + 1);
        }
        emit CloseBilling(billingCycle, totalSoldReward);
    }

    function trySwapAndClose(
        address swapRouter,
        uint256 amountInMaximum,
        uint256 amountOut
    ) internal returns(bool, uint256) {
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
                'exactOutputSingle((address,address,uint24,address,uint256,uiint256,uint256,uint160))',
                params
            )
        );
        TransferHelper.safeApprove(s.reward, swapRouter, 0);
        return success ? abi.decode(encoded) : 0;
    }
}
