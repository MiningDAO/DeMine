// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";

import './TokenLockerStorage.sol';
import './utils/PayableInternal.sol';
import './utils/CustodianStorage.sol';

abstract contract TokenLockerInternal is PayableInternal, Context {
    using TokenLockerStorage for TokenLockerStorage.Layout;

    event Claim(address indexed, address indexed, uint128 indexed, address);
    event Redeem(address indexed, uint128 indexed, address);

    function _redeem(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    )
        internal
        returns(uint256[] memory)
    {
        require(
            cycles.length == amounts.length,
            "TokenLocker: array length mismatch"
        );
        uint256 tokenCost = TokenLockerStorage.layout().pools[pool].cost;
        uint256 totalCost;
        uint256[] memory ids = new uint256[](cycles.length);
        for (uint256 i = 0; i < cycles.length; i++) {
            ids[i] = (uint256(pool) << 128) + cycles[i];
            totalCost += tokenCost * amounts[i];
        }
        address custodian = CustodianStorage.layout().checking;
        payFrom(payment, _msgSender(), custodian, totalCost);
        emit Redeem(_msgSender(), pool, payment);
        return ids;
    }

    function _claim(
        address claimer,
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) internal returns(uint256[] memory) {
        require(
            cycles.length == amounts.length,
            "TokenLocker: array length mismatch"
        );
        uint256 basePrice = TokenLockerStorage.layout().pools[pool].price;
        uint256 totalToPay;
        uint256[] memory ids = new uint256[](cycles.length);
        TokenLockerStorage.Layout storage l = TokenLockerStorage.layout();
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            l.decreaseAllowance(id, claimer, amounts[i]);
            totalToPay += (
                l.prices[id] > 0 ? l.prices[id] : basePrice
            ) * amounts[i];
            ids[i] = id;
        }
        address custodian = CustodianStorage.layout().checking;
        payFrom(payment, _msgSender(), custodian, totalToPay);
        emit Claim(_msgSender(), claimer, pool, payment);
        return ids;
    }
}
