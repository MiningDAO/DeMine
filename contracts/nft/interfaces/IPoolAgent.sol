// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/token/ERC1155/IERC1155Internal.sol';

interface IPoolAgent is IERC1155Internal {
    /**
     * @dev Mint new tokens to pool agent, can only called by registered agent
     * @param cycles List of cycles to mint with pool
     * @param amounts List of amount of each NFT id
     */
    function mintBatch(uint128[] memory cycles, uint[] memory amounts) external;

    /**
     * @dev burn tokens not mined and return balance of token, can only called by registered agent
     * @param cycles List of cycle to burn with pool
     * @return balance of token at pool and cycle
     */
    function shrink(uint128[] cycles) external returns(uint[] memory);
}
