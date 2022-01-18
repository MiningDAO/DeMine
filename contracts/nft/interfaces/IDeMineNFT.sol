// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/token/ERC1155/IERC1155Internal.sol';

/**
 * @dev Interface for DeMineNFT for DeMineAgent
 */
interface IDeMineNFT is IERC1155Internal {
    /**
     * @dev burn token not mined yet
     * @param account Address of token holder
     * @param ids List of token ids to burn
     */
    function shrink(address account, uint[] memory ids) external;

    /**
     * @dev burn token mined and cashout income
     * @param account Address of token holder
     * @param id Token id to achemize
     * @return total income
     */
    function alchemize(address account, uint id) external returns(uint);

    /**
     * @dev burn tokens mined for one pool in batch and cashout income
     * @param account Address of token holder
     * @param ids List of token ids to alchemize
     * @return total income
     */
    function alchemizeBatch(address account, uint[] memory ids) external returns(uint);

    function getMining() external view returns(uint128);
}
