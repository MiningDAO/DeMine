// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";

import '../utils/PayableInternal.sol';
import './RewarderStorage.sol';

abstract contract RewarderInternal is PayableInternal, Context {
    event Cashout(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 income
    );

    function _cashout(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) internal {
        RewarderStorage.Layout storage l = RewarderStorage.layout();
        uint256 totalIncome;
        for (uint256 i = 0; i < ids.length; i++) {
            uint128 cycle = uint128(ids[i]);
            require(cycle <= l.cycle, "Rewarder: unrewarded cycle");
            totalIncome += amounts[i] * l.cycles[cycle].reward;
        }
        pay(l.rewardToken, to, totalIncome);
        emit Cashout(_msgSender(), from, to, totalIncome);
    }

    function _addSupply(
        uint128 pool,
        uint128 startCycle,
        uint128 numCycles,
        uint256[] calldata supplies
    ) internal returns(uint256[] memory) {
        require(
            supplies.length == numCycles,
            "TokenLocker: supply array length mismatch"
        );
        require(
            startCycle > RewarderStorage.layout().cycle,
            "TokenLocker: started from rewarded cycle"
        );
        uint256[] memory ids = new uint256[](numCycles);
        for (uint128 i = 0; i < numCycles; i++) {
            uint128 cycle = startCycle + i;
            ids[i] = (uint256(pool) << 128) + cycle;
            RewarderStorage.layout().cycles[cycle].supply += supplies[i];
        }
        return ids;
    }
}
