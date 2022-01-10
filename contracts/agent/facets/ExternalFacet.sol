// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';

contract DeMineNFTFacet is PausableModifier {
    using SafeERC20 for IERC20;
    AppStorage internal s;

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
    ) external {
        ERC1155WithAgentFacet(s.nft).burnBatch(
            msg.sender, account, ids, amounts
        );
        uint256 totalIncome;
        for (uint256 i = 0; i < ids.length; i++) {
            require(
                ids[i] < s.rewardingCycle,
                "DeMineNFT: unrewarded cycle"
            );
            totalIncome += amounts[i] * s.cycles[ids[i]].reward;
        }
        IERC20(s.rewardToken).safeTransfer(recipient, totalIncome);
        emit Cashout(msg.sender, account, recipient, totalIncome);
    }
}
