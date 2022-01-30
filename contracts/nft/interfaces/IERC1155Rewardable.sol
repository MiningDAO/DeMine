// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/token/ERC1155/IERC1155.sol';

interface IERC1155Rewardable is IERC1155 {
    function getRewardToken() external view returns (address);

    function getAlchemist() external view returns (address);
}
