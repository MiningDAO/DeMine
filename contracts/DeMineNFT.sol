// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC1155.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/// @title DeMineNFT
/// @author Shu Dong
/// This smart contract enables DeMine DAO to issue new NFTs and manage value of them.
contract DeMineNFT is
    ERC1155,
    Ownable,
    ReentrancyGuard,
    Pausable,
    IERC2981
{
    // Events
    event LogEthDeposit(address);
    event TokenRoyaltySet(address, uint256);
    event CostTokenAddressSet(address);
    event RewardTokenAddressSet(address);
    event LastBillingCycleSet(uint256);

    event NewSupply(uint128, string, uint256, address);
    event Reward(uint128, address, uint256, uint256);
    event Locked();
    event Unlocked(uint256);
    event Withdraw(uint256, uint256);

    address private _rewardToken;
    address private _costToken;
    uint128 private _nextCycle;
    uint128 private _nextRound;
    uint128 private _lastBillingCycle;

    // EIP2981
    address private _royaltyRecipient;
    uint16 private _royaltyBps;

    mapping(uint128 => uint256) private _cycleToTokenReward;
    mapping(uint128 => uint256) private _roundToTokenCost;
    mapping(uint256 => uint256) private _adjustments; // token_id to adjustment

    constructor (
        string memory uri,
        address rewardToken,
        address costToken,
        address royaltyRecipient,
        uint16 royaltyBps
    ) Ownable() ERC1155(uri) {
        _rewardToken = rewardToken;
        _costToken = costToken;
        _royaltyRecipient = royaltyRecipient;
        _royaltyBps = royaltyBps;
    }

    fallback() external payable {
        emit LogEthDeposit(_msgSender());
    }

    receive() external payable {
        emit LogEthDeposit(_msgSender());
    }

    function newSupply(
        uint256[] calldata tokenIds,
        uint256[] calldata supplys,
        string calldata infoHash,
        uint256 costPerToken,
        address recipient
    ) external onlyOwner whenNotPaused {
        require(
            tokenIds.length == supplys.length,
            "array length mismatch"
        );
        _mintBatch(recipient, tokenIds, supplys, "");
        _roundToTokenCost[_nextRound] = costPerToken;
        emit NewSupply(
            _nextRound,
            infoHash,
            costPerToken,
            recipient
        );
        _nextRound += 1;
    }

    function reward(
        address payer,
        uint256 totalRewardPaid,
        uint256 rewardPerToken,
        uint128[] calldata rounds,
        uint256[] calldata adjustments
    ) external onlyOwner nonReentrant {
        require(
            rounds.length == adjustments.length,
            "array length mismatch"
        );
        for (uint128 i = 0; i < rounds.length; i++) {
            require(adjustments[i] < 1000000, "invalid adjustment value");
            _adjustments[uint256(rounds[i]) << 128 + _nextCycle] = adjustments[i];
        }
        _cycleToTokenReward[_nextCycle] = rewardPerToken;
        bool success = ERC20(_rewardToken).transferFrom(
            payer,
            address(this),
            totalRewardPaid
        );
        require(success, "failed to transfer reward");
        emit Reward(
            _nextCycle,
            payer,
            totalRewardPaid,
            rewardPerToken
        );
        _nextCycle += 1;
    }

    function lock() external onlyOwner whenNotPaused {
        _pause();
        bool success = ERC20(_rewardToken).approve(owner(), 2 ** 256 - 1);
        require(success, "failed to approve");
        emit Locked();
    }

    function unlock(uint128 billingCycle) external onlyOwner whenPaused {
        bool success = ERC20(_rewardToken).approve(owner(), 0);
        require(success, "failed to revoke approve");
        _lastBillingCycle = billingCycle;
        _unpause();
        emit Unlocked(billingCycle);
    }

    function withdraw(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external nonReentrant whenNotPaused {
        require(
            tokenIds.length == amounts.length,
            "array length mismatch"
        );
        uint256 totalCost;
        uint256 totalReward;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint128 cycle = uint128(tokenIds[i]);
            // burn token
            _safeTransferFrom(
                msg.sender,
                address(0x0),
                tokenIds[i],
                amounts[i],
                ""
            );

            totalReward += adjust(
                amounts[i] * _cycleToTokenReward[cycle],
                _adjustments[i]
            );
            if (cycle > _lastBillingCycle) {
                totalCost += adjust(
                    amounts[i] * _roundToTokenCost[uint128(tokenIds[i] >> 128)],
                    _adjustments[i]
                );
            }
        }
        // pay cost
        bool success = ERC20(_costToken).transferFrom(
            msg.sender,
            address(this),
            totalCost
        );
        require(success, "failed to pay cost");
        // withdraw reward coin
        success = ERC20(_rewardToken).transferFrom(
            address(this),
            msg.sender,
            totalReward
        );
        require(success, "failed to get reward");
        emit Withdraw(totalReward, totalCost);
    }

    // set functions
    function setTokenRoyalty(
        address recipient,
        uint16 bps
    ) external onlyOwner {
        _royaltyRecipient = recipient;
        _royaltyBps = bps;
        emit TokenRoyaltySet(recipient, bps);
    }

    function resetTokenCost(
        uint128[] calldata round,
        uint256[] calldata cost
    ) external onlyOwner {
        require(round.length == cost.length, "array length not match");
        for (uint256 i = 0; i < round.length; i++) {
            _roundToTokenCost[round[i]] = cost[i];
        }
    }

    function setCostToken(address costToken) external onlyOwner {
        _costToken = costToken;
        emit CostTokenAddressSet(costToken);
    }

    // pure functions
    function adjust(
        uint256 value,
        uint256 adjustment
    ) internal pure returns (uint256) {
        return value - value * adjustment / 1000000;
    }

    // view functions

    function getTokenStats(uint256 tokenId)
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (
            _cycleToTokenReward[uint128(tokenId)],
            _roundToTokenCost[uint128(tokenId >> 128)],
            _adjustments[tokenId]
        );
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address, uint256)
    {
        return (
            _royaltyRecipient,
            (value * _royaltyBps) / 10000
        );
    }
}
