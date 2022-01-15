// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library BillingStorage {
    struct RewardTokenLockedPrice {
        uint256 uintSize;
        uint256 uintPrice;
        uint expireAt;
    }

    struct Layout {
        mapping(address => RewardTokenLockedPrice) lockedPrices;
        // reward sale
        uint sold;
        uint saleExpireAt;
        uint16 discount; // 10000 based
        uint16 saleDuration; // as second
        uint16 priceLockDuration; // as second
        uint8 chainlinkDecimals;
        address chainlink;
        address swapRouter;
        uint8 shrinkSize; // num of tokens we shrink starting from next rewarding token
        uint shrinked; // current shrinked token
        uint startAt; // timestamp
        uint billing; // tokenId
        uint balance; // balance of billing token agent holds
        uint reward;
        uint debt;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('demine.agent.contracts.storage.Billing');

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
