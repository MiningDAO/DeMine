// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../lib/AppStorage.sol';
import '../lib/LibBilling.sol';

contract ERC20RewardableFacet is PausableModifier, BillingInternal {
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

    function rewardCurrent(
        address rewarder,
        uint256 totalReward
    ) external onlyOwner {
        uint256 rewarding = s.rewardingCycle;
        reward(rewarding, rewarder, totalReward);
    }

    function rewardNext(
        address rewarder,
        uint256 totalReward
    ) external onlyOwner {
        uint256 rewarding = s.rewardingCycle;
        s.rewardingCycle = rewarding + 1;
        reward(rewarding + 1, rewarder, totalReward);
        LibBilling.billing(s, rewarding);
    }

    function reward(
        uint256 id,
        address rewarder,
        uint256 totalReward
    ) internal {
        uint256 supply = s.info[rewarding].supply;
        if (supply > 0) {
            uint256 rewardPerToken = totalReward / supply;
            s.info[id].reward += rewardPerToken;
            IERC20(s.reward).safeTransferFrom(
                rewarder,
                address(this),
                supply * rewardPerToken
            );
            emit Reward(id, rewarder, rewardPerToken, supply);
        }
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
                "DeMineNFT: unrewarded token"
            );
            totalIncome += amounts[i] * s.info[ids[i]].reward;
        }
        IERC20(s.reward).safeTransfer(recipient, totalIncome);
        emit Cashout(recipient, totalIncome);
    }

    function tokenInfo(uint256 token) external view returns(uint256, uint256) {
        return (
            s.info[token].supply,
            s.info[token].reward
        );
    }
}
