// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../lib/AppStorage.sol';
import '../lib/LibERC20Rewardable.sol';

contract ERC20RewardableFacet {
    using EnumerableSet for EnumerableSet.UintSet;

    AppStorage Internal s;

    event Reward(uint128 indexed, address, uint256, uint256);

    function reward(
        uint128 cycle,
        address rewarder,
        uint256 rewarded
    ) external onlyOwner {
        require (
            cycle >= s.rewardingCycle,
            "Reward: cycle already rewarded"
        );
        uint256 supply = s.cycles[cycle].supply;
        require(supply > 0, "Reward: cycle supply is 0");

        uint256 rewardPerToken = rewarded / supply;
        s.cycles[cycle].reward += rewardPerToken;

        IERC20(s.reward).safeTransferFrom(
            rewarder,
            address(this),
            supply * rewardPerToken
        );
        emit Reward(cycle, rewarder, rewardPerToken, supply);
    }

    function billing(uint128 pool, uint128 billingCycle) external onlyOwner {
        require(
            billingCycle < s.rewardingCycle,
            "DeMineAgent: unrewarded cycle"
        );
        uint256[] memory ids = new uint256[]();
        uint256[] memory amounts = new uint256[]();
        for (uint128 cycle = s.lastBillingCycle + 1; cycle <= billingCycle; cycle++) {
            AppStorage.Cycle memory cycle = s.cycles[cycle];
            mapping(uint128 => uint256) memory balances = s.balances[cycle];
            uint256[] memory pools = cycle.pools.values();
            for (uint256 j = 0; j < pools.length; j++) {
                s.pools[pool].locked += balances[pool] * cycle.reward;
                ids.push((uint256(entries[j].key) << 128) + cycle);
                amounts.push(balances[pool]);
            }
        }
        ERC1155WithAgentFacet(s.nft).burnBatch(
            address(this), address(this), ids, amounts
        );
        l.lastBillingCycle = billingCycle;
    }

    function cycleInfo(
        uint128 cycle
    ) external view returns(uint256, uint256) {
        return (
            s.cycles[cycle].supply,
            s.cycles[cycle].reward
        );
    }
}
