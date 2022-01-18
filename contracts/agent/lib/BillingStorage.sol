// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library BillingStorage {
    enum Stage{ NOT_STARTED, SALE_ONGOING }

    struct LockedPrice {
        uint256 unitSize;
        uint256 unitPrice;
        uint expireAt;
    }

    // do not add field to this struct,
    // migrate to new struct if needed
    struct Statement {
        uint balance;
        uint income;
        uint debt;
    }

    struct Layout {
        Stage stage;
        uint16 discount; // 10000 based
        uint16 saleDuration; // as second
        uint16 priceLockDuration; // as second
        uint saleExpireAt; // timestamp
        AggregatorV3Interface chainlink;
        address swapRouter;
        mapping(uint128 => Statement) statements;
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
