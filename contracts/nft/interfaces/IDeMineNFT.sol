// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/token/ERC1155/IERC1155.sol';

/**
 * @dev Interface for DeMineNFT for DeMineAgent
 */
interface IDeMineNFT is IERC1155 {
    /**
     * @dev Mint new tokens and transfer them to DeMineAgent
     * @param ids List of NFT ids
     * @param amounts List of amount of each NFT id
     */
    function mintBatch(uint[] memory ids, uint[] memory amounts) external;

    /**
     * @dev burn tokens of agent and return balance of token
     * @param tokenId NFT token to burn
     */
    function burn(uint tokenId) external returns(uint);
}
