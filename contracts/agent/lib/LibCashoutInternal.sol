// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./LibAppStorage.sol";

library LibCashoutInternal {
    using SafeERC20 for IERC20;

    event Cashout(
        address indexed operator,
        address indexed account,
        address indexed recipient,
        uint256 reward
    );

    function cashout(
        address account,
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) internal {
        AppStorage storage s = LibAppStorage.layout();
        uint256 totalIncome;
        for (uint256 i = 0; i < ids.length; i++) {
            uint128 cycle = uint128(ids[i]);
            require(
                cycle <= s.lastRewardedCycle,
                "DeMineNFT: unrewarded cycle"
            );
            totalIncome += amounts[i] * s.cycles[cycle].reward;
        }
        IERC20(s.reward).safeTransfer(recipient, totalIncome);
        emit Cashout(msg.sender, account, recipient, totalIncome);
    }
}
