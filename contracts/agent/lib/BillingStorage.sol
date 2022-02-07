// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library BillingStorage {
    enum Stage{ NOT_STARTED, SALE_ONGOING }

    struct LockedPrice {
        uint unitSize;
        uint unitPrice;
        uint expireAt;
    }

    struct Layout {
        AggregatorV3Interface chainlink;
        address swapRouter;
        Stage stage;
        uint8 shrinkSize; // num of tokens we shrink starting from mining
        uint16 discount; // 10000 based
        uint16 saleDuration; // as second
        uint16 priceLockDuration; // as second
        uint shrinked; // latest token shrinked
        uint saleExpireAt; // timestamp
        mapping(address => LockedPrice) lockedPrices;
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
