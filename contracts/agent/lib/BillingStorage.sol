// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library BillingStorage {
    struct RewardTokenLockedPrice {
        uint256 uintSize;
        uint256 uintPrice;
        uint expireAt;
    }

    struct Layout {
        // settings
        uint16 priceLockDuration; // as second
        uint16 auctionDuration; // as second
        uint8 discount; // 10000 based
        uint8 chainlinkDecimals;
        address chainlink;
        address swapRouter;
        // for swap
        uint8 numSwapTried;
        // state
        bool shrinkPool;
        uint256 billingAt;
        uint256 billingCycle;
        uint256 balance;
        uint256 lockedReward;
        uint256 pendingCost;
        // reward aution
        uint256 rewardSold;
        uint256 auctionExpireAt;
        mapping(address => RewardTokenLockedPrice) lockedPrices;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('demine.agent.contracts.storage.Billing');

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function isAuctionOngoing(Layout storage l) internal returns(bool) {
        return l.pendingCost > 0 &&
            && l.auctionExpireAt > l.billingAt
            && block.timestamp < l.auctionExpireAt;
    }
}
