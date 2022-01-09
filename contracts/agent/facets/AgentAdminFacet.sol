// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';

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

    modifier onlyMinted(address from) {
        require(
            msg.sender == s.nft && from == address(0),
            'DeMineAgent: only minted tokens from nft contract allowed'
        );
        _;
    }

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
            startCycle > s.rewardingCycle,
            "DeMine: started from rewarded cycle"
        );
        uint256[] memory ids = new uint256[](numCycles);
        for (uint128 i = 0; i < numCycles; i++) {
            uint128 cycle = startCycle + i;
            ids[i] = (uint256(pool) << 128) + cycle;
            s.cycles[cycle].supply += supplies[i];
            s.locked[cycle][pool] += supplies[i];
        }
        ERC1155WithAgentFacet(s.nft).mintBatch(address(this), ids, supplies);
    }

    function onERC1155Received(
        address,
        address from,
        uint256,
        uint256,
        bytes memory data
    ) external onlyMinted(from) override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata,
        uint256[] calldata,
        bytes memory data
    ) external onlyMinted(from) override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
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
}
