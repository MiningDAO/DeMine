// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';
import '../lib/LibAppStorage.sol';
import '../lib/LibCustodian.sol';
import '../lib/LibERC20Payable.sol';

contract PoolAdminFacet is PausableModifier {
    using LibAppStorage for AppStorage;
    AppStorage internal s;

    modifier onlyPoolOwner(uint128 pool) {
        require(
            msg.sender == s.pools[pool].owner,
            "PoolMetadata: only pool owner allowed"
        );
        _;
    }

    event Redeem(address indexed, uint128 indexed, address);
    event TransferPool(uint128 indexed, address, address);
    event SetPoolPrice(uint128 indexed, uint256);
    event SetTokenPrices(
        address indexed,
        uint128 indexed,
        uint128[],
        uint256[]
    );
    event IncreaseAllowance(
        address indexed,
        address indexed,
        uint128 indexed,
        uint128[],
        uint256[]
    );
    event DecreaseAllowance(
        address indexed,
        address indexed,
        uint128 indexed,
        uint128[],
        uint256[]
    );

    function increaseAllowance(
        address to,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata increment
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == increment.length,
            "PoolOwnerFacet: array length mismatch"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            s.allowances[id][to] += increment[i];
        }
        emit IncreaseAllowance(msg.sender, to, pool, cycles, increment);
    }

    function decreaseAllowance(
        address to,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == amounts.length,
            "DeMineNFTMetadata: array length mismatch"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            s.decreaseAllowance(id, to, amounts[i]);
        }
        emit DecreaseAllowance(msg.sender, to, pool, cycles, amounts);
    }

    function transferPool(
        uint128 pool,
        address owner
    ) external whenNotPaused onlyPoolOwner(pool) {
        s.setPoolOwner(pool, owner);
        emit TransferPool(pool, msg.sender, owner);
    }

    function setTokenDefaultPrice(
        uint128 pool,
        uint256 price
    ) external whenNotPaused onlyPoolOwner(pool) {
        s.setDefaultTokenPrice(pool, price);
        emit SetPoolPrice(pool, price);
    }

    function setTokenPrices(
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata newPrices
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == newPrices.length,
            "DeMineAgent: array length mismatch"
        );
        uint256 tokenCost = s.pools[pool].tokenCost;
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            require(
                newPrices[i] >= tokenCost,
                "DeMineAgent: price too low to cover cost"
            );
            s.prices[id] = newPrices[i];
        }
        emit SetTokenPrices(msg.sender, pool, cycles, newPrices);
    }

    function redeem(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == amounts.length,
            "PoolOwnerFacet: array length mismatch"
        );
        uint256 tokenCost = s.pools[pool].tokenCost;
        uint256 totalCost;
        uint256[] memory ids = new uint256[](cycles.length);
        for (uint256 i = 0; i < cycles.length; i++) {
            ids[i] = (uint256(pool) << 128) + cycles[i];
            totalCost += tokenCost * amounts[i];
        }
        address custodian = LibCustodian.layout().checking;
        LibERC20Payable.pay(payment, msg.sender, custodian, totalCost);
        emit Redeem(msg.sender, pool, payment);
        ERC1155WithAgentFacet(s.nft).safeBatchTransferFrom(
            address(this),
            msg.sender,
            ids,
            amounts,
            ""
        );
    }

    function getAllowances(
        address recipient,
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory result = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = s.allowances[ids[i]][recipient];
        }
        return result;
    }

    function getPrices(
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory result = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            uint128 pool = uint128(id >> 128);
            uint256 basePrice = s.pools[pool].tokenPrice;
            result[i] = s.prices[id] > 0 ? s.prices[id] : basePrice;
        }
        return result;
    }
}
