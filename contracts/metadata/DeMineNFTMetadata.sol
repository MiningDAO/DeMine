// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';

import '../utils/PausableInternal.sol';
import './PoolMetadataInternal.sol';
import './DeMineNFTMetadataStorage.sol';

contract DeMineNFTMetadata is
    PoolMetadataInternal,
    OwnableInternal,
    PausableInternal
{
    using DeMineNFTMetadataStorage for DeMineNFTMetadataStorage.Layout;

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

    function setTokenPrices(
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata newPrices
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == newPrices.length,
            "DeMineNFTMetadata: array length mismatch"
        );
        uint256 tokenCost = getTokenCost(pool);
        mapping(uint256 => uint256)
            storage prices = DeMineNFTMetadataStorage.layout().prices;
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            require(
                newPrices[i] >= tokenCost,
                "DeMineNFTMetadata: price too low to cover cost"
            );
            prices[id] = newPrices[i];
        }
        emit SetTokenPrices(_msgSender(), pool, cycles, newPrices);
    }

    function increaseAllowance(
        address to,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata increment
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == increment.length,
            "DeMineNFTMetadata: array length mismatch"
        );
        mapping(uint256 => mapping(address => uint256))
            storage allowances = DeMineNFTMetadataStorage.layout().allowances;
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            allowances[id][to] += increment[i];
        }
        emit IncreaseAllowance(_msgSender(), to, pool, cycles, increment);
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
        DeMineNFTMetadataStorage.Layout storage l = DeMineNFTMetadataStorage.layout();
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            l.decreaseAllowance(id, to, amounts[i]);
        }
        emit DecreaseAllowance(_msgSender(), to, pool, cycles, amounts);
    }

    function getAllowances(
        address recipient,
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory result = new uint256[](ids.length);
        mapping(uint256 => mapping(address => uint256))
            storage allowances = DeMineNFTMetadataStorage.layout().allowances;
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = allowances[ids[i]][recipient];
        }
        return result;
    }

    function getPrices(
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory result = new uint256[](ids.length);
        mapping(uint256 => uint256)
            storage prices = DeMineNFTMetadataStorage.layout().prices;
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            uint128 pool = uint128(id >> 128);
            uint256 basePrice = getDefaultTokenPrice(pool);
            result[i] = prices[id] > 0 ? prices[id] : basePrice;
        }
        return result;
    }
}
