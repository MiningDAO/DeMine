// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IMortgage {
    /**
     * @dev Mortgage your computation power(offline) and mint demine nft.
     * Minted tokens are locked at DeMineAgent contract.
     * @param start DeMine nft id to mint
     * @param end DeMine nft id to mint
     * @param supply Amount for each token to mint. This also decide
     * amount of deposit mortgager has to pay
     * @param data Extra data with mortgager address encoded
     */
    function mortgage(uint128 start, uint128 end, uint supply, bytes memory data) external;
}
