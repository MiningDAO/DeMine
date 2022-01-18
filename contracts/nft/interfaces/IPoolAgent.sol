// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/token/ERC1155/IERC1155Internal.sol';

interface IPoolAgent is IERC1155Internal {
    /**
     * @dev burn tokens not mined, can only called by registered agent
     * @param start Start cycle
     * @param end End cycle
     */
    function shrink(uint128 start, uint128 end) external;
}
