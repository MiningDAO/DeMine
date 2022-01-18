// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IDeMineAgent {
    /**
     * @dev callback of mint function of DeMineNFT contract.
     * @param start DeMine nft id to mint
     * @param end DeMine nft id to mint
     * @param supply Amount for each token to mint. This also decide
     * amount of deposit mortgager has to pay
     * @param data Extra data with mortgager address encoded
     */
    function postMint(
        uint128 start,
        uint128 end,
        uint supply,
        bytes memory data
    ) external returns(uint128);
}
