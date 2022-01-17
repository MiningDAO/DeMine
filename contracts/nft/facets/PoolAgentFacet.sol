// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/utils/AddressUtils.sol';
import '@solidstate/contracts/token/ERC1155/base/ERC1155BaseStorage.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/LibTokenId.sol';
import '../interfaces/IDeMineNFT.sol';
import '../lib/AppStorage.sol';

contract PoolAgentFacet is
    IPoolAgent,
    OwnableInternal,
    PausableModifier
{
    AppStorage internal s;
    using AddressUtils for address;
    using SafeERC20 for IERC20;

    event RegisterPool(uint128 indexed, address indexed);
    event Finalize(uint128 indexed, address indexed, uint, uint);

    function registerPool(address agent, uint128 pool) external onlyOwner {
        // 0 is reserved for non-existence check
        require(agent.isContract() && pool > 0, 'DeMineNFT: invalid input');
        require(
            s.agents[pool] == address(0) && s.pools[agent] == 0,
            'DeMineNFT: pool already registered'
        );
        s.agents[pool] = agent;
        s.pools[agent] = pool;
        emit RegisterPool(pool, agent);
    }

    function finalizeCycle(address source, uint income) external onlyOwner {
        uint mining = s.mining;
        s.cycles[mining].income = income;
        uint supply = s.cycles[mining].supply;
        uint total = supply * income;
        if (total > 0) {
            s.income.safeTransferFrom(source, address(this), total);
        }
        emit Finalize(mining, source, income, supply);
        s.mining = mining + 1;
    }

    function mintBatch(
        uint128[] memory cycles,
        uint[] memory amounts
    ) external whenNotPaused {
        uint128 pool = s.pools[msg.sender];
        require(pool > 0, 'DeMineNFT: only registered agent is allowed');
        require(
            cycles.length == amounts.length,
            'DeMineAgent: array length mismatch'
        );
        ERC1155BaseStorage.Layout storage balances = ERC1155BaseStorage.layout();
        uint[] memory ids = new uint[](cycles.length);
        for (uint i; i < cycles.length; i++) {
            uint id = LibTokenId.encode(pool, cycles[i]);
            ids[i] = id;
            balances[id][msg.sender] += amounts[i];
            s.cycles[cycles[i]].supply += amounts[i];
        }
        emit TransferBatch(msg.sender, address(0), msg.sender, ids, amounts);
    }

    function shrink(uint128[] cycles) external whenNotPaused returns(uint[] memory) {
        uint128 pool = s.pools[msg.sender];
        require(pool > 0, 'DeMineNFT: only registered agent is allowed');
        ERC1155BaseStorage.Layout storage balances = ERC1155BaseStorage.layout();
        uint[] memory ids = new uint[](cycles.length);
        uint[] memory amounts = new uint[](cycles.length);
        unchecked {
            for (uint256 i; i < cycles.length; i++) {
                require(cycle > s.mining + 1, 'DeMineNFT: token already mined or mining');
                uint id = LibTokenId.encode(pool, cycles[i]);
                ids[i] = id;
                amounts[i] = balances[id][msg.sender];
                balances[id][msg.sender] = 0;
            }
        }
        emit TransferBatch(msg.sender, account, address(0), ids, amounts);
        return amounts;
    }

    function getAgent(uint128 pool) external view returns(address) {
        return s.agents[pool];
    }

    function getPool(address agent) external view returns(uint128) {
        return s.pools[agent];
    }

    function getCycle(uint128 cycle) external view returns(Cycle memory) {
        return s.cycles[cycle];
    }
}
