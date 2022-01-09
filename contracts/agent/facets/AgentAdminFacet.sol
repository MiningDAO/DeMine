// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../lib/LibCashoutInternal.sol';
import '../lib/AppStorage.sol';
import '../lib/LibAppStorage.sol';
import '../lib/LibCustodian.sol';

contract AgentAdminFacet is Custodian {
    using SafeERC20 for IERC20;
    using LibAppStorage for AppStorage;
    AppStorage internal s;

    event CreatePool(uint128 indexed, address indexed, uint256, uint256);
    event Reward(uint128 indexed, address, uint256, uint256);

    modifier onlyExistingPool(uint128 pool) {
        require(pool < s.nextPool, "DeMineAgent: pool doesn't exsit");
        _;
    }

    function createPoolWithSupply(
        address owner,
        uint256 tokenCost,
        uint256 tokenPrice,
        uint128 startCycle,
        uint128 numCycles,
        uint256[] calldata supplies
    ) external onlyOwner {
        uint128 pool = s.createPool(owner, tokenCost, tokenPrice);
        addSupply(pool, startCycle, numCycles, supplies);
        emit CreatePool(pool, owner, tokenCost, tokenPrice);
    }

    function addSupply(
        uint128 pool,
        uint128 startCycle,
        uint128 numCycles,
        uint256[] calldata supplies
    ) public onlyExistingPool(pool) onlyOwner {
        require(
            supplies.length == numCycles,
            "DeMine: supply array length mismatch"
        );
        require(
            startCycle > s.lastRewardedCycle,
            "DeMine: started from rewarded cycle"
        );
        uint256[] memory ids = new uint256[](numCycles);
        for (uint128 i = 0; i < numCycles; i++) {
            uint128 cycle = startCycle + i;
            ids[i] = (uint256(pool) << 128) + cycle;
            s.cycles[cycle].supply += supplies[i];
        }
        ERC1155WithAgentFacet(s.nft).mintBatch(ids, supplies);
    }

    function cashout(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        ERC1155WithAgentFacet(s.nft).burnBatch(
            address(this), address(this), ids, amounts
        );
        address checking = LibCustodian.layout().checking;
        LibCashoutInternal.cashout(address(this), checking, ids, amounts);
    }

    function reward(
        uint128 cycle,
        address rewarder,
        uint256 rewarded
    ) external onlyOwner {
        require (
            cycle >= s.lastRewardedCycle,
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

    function poolInfo(
        uint128 pool
    ) external view returns(address, uint256, uint256) {
        return (
            s.pools[pool].owner,
            s.pools[pool].tokenCost,
            s.pools[pool].tokenPrice
        );
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
