// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

library BillingStorage {
    struct RewardTokenLockedPrice {
        uint256 uintSize;
        uint256 uintPrice;
        uint expireAt;
    }

    struct Layout {
        uint sold;
        uint saleExpireAt;
        uint16 discount; // 10000 based
        uint16 saleDuration; // as second
        uint16 priceLockDuration; // as second
        uint startAt; // timestamp
        uint billing; // tokenId
        uint balance; // balance of billing token agent holds
        uint income;
        uint debt;
        AggregatorV3Interface chainlink;
        ISwapRouter swapRouter;
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
}
