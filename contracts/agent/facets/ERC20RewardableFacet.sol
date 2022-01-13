// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../lib/AppStorage.sol';

contract ERC20RewardableFacet is PausableModifier {
    using SafeERC20 for IERC20;

    AppStorage internal s;

    modifier onlyNFT() {
        require(
            msg.sender == s.nft,
            'DeMineNFTFacet: only nft contract is allowed'
        );
        _;
    }

    event SetRewardTokenAuction(uint256, uint256, uint256);
    event Cashout(address indexed recipient, uint256 income);
    event Reward(uint256 indexed, address, uint256, uint256);

    function reward(
        uint256 tokenId,
        address rewarder,
        uint256 rewarded
    ) external onlyOwner {
        require (
            cycle >= s.rewardingCycle,
            "Reward: cycle already rewarded"
        );
        uint256 supply = s.cycles[cycle].supply;
        require(supply > 0, "Reward: cycle supply is 0");

        uint256 rewardPerToken = rewarded / supply;
        s.cycles[cycle].reward += rewardPerToken;

        IERC20(s.reward).safeTransferFrom(
            rewarder,
            address(this),
            supply * rewardPerToken
        );
        emit Reward(cycle, rewarder, rewardPerToken, supply);
    }

    function cashout(
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external whenNotPaused onlyNFT {
        uint256 totalIncome;
        for (uint256 i = 0; i < ids.length; i++) {
            require(
                ids[i] < s.rewardingCycle,
                "DeMineNFT: unrewarded cycle"
            );
            totalIncome += amounts[i] * s.cycles[ids[i]].reward;
        }
        IERC20(s.reward).safeTransfer(recipient, totalIncome);
        emit Cashout(recipient, totalIncome);
    }

    function cycleInfo(uint256 cycle) external view returns(uint256, uint256) {
        return (
            s.cycles[cycle].supply,
            s.cycles[cycle].reward
        );
    }
}
