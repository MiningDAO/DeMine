// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/LibPausable.sol';
import '../../nft/facets/ERC1155WithAgentFacet.sol';
import '../lib/AppStorage.sol';

contract RewardableFacet is PausableModifier {
    using SafeERC20 for IERC20;

    AppStorage internal s;

    modifier onlyNFT() {
        require(
            msg.sender == s.nft,
            'DeMineNFTFacet: only nft contract is allowed'
        );
        _;
    }

    event Cashout(address indexed recipient, uint256 income);
    event Reward(uint256 indexed, address, uint256, uint256);

    function reward(
        address rewarder,
        uint256 totalReward
    ) external onlyOwner {
        uint256 rewarding = s.rewardingCycle;
        uint256 supply = s.info[rewarding].supply;
        if (supply > 0) {
            uint256 rewardPerToken = totalReward / supply;
            s.info[rewarding].reward += rewardPerToken;
            IERC20(s.reward).safeTransferFrom(
                rewarder,
                address(this),
                supply * rewardPerToken
            );
            emit Reward(rewarding, rewarder, rewardPerToken, supply);
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

    function tokenInfo(
        uint256 token
    ) external view returns(TokenInfo memory) {
        return s.info[token];
    }
}
