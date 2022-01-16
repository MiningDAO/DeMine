// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

/**
 * @dev Interface for DeMineAgent for DeMineNFT
 */
interface IDeMineAgent {
    /**
     * @dev Cashout incomes with listed tokens and amounts
     * @param recipient Address to recieve the cashed out income
     * @param ids List of NFT ids
     * @param amounts List of amount of each NFT id
     */
    function cashout(address recipient, uint[] memory ids, uint[] memory amounts) external;
}
