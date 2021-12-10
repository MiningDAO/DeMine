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

    event NewSupply(uint128, string, uint256, uint256, uint128, uint128);
    event Reward(uint128, address, uint256, uint256);
    event RewardExtracted(uint256, address);
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
        string calldata infoHash,
        uint256 supplyPerCycle,
        uint256 costPerCycle,
        uint128 startCycle,
        uint128 numCycles
    ) external onlyOwner whenNotPaused {
        require(numCycles < 10000, "exceeding max period allowed");
        for (uint128 i = startCycle; i < startCycle + numCycles; i++) {
            _mint(owner(), encode(_nextRound, i), supplyPerCycle, "");
        }
        _roundToTokenCost[_nextRound] = costPerCycle / supplyPerCycle;
        emit NewSupply(
            _nextRound,
            infoHash,
            supplyPerCycle,
            costPerCycle,
            startCycle,
            numCycles
        );
        _nextRound += 1;
    }

    function reward(
        address payer,
        uint256 totalRewardPaid,
        uint256 rewardPerToken
    ) external onlyOwner nonReentrant {
        _cycleToTokenReward[_nextCycle] = rewardPerToken;
        ERC20(_rewardToken).transferFrom(
            payer,
            address(this),
            totalRewardPaid
        );
        emit Reward(
            _nextCycle,
            payer,
            totalRewardPaid,
            rewardPerToken
        );
        _nextCycle += 1;
    }

    function extractReward(
        uint256 rewards,
        address receipt
    ) external onlyOwner whenPaused {
        ERC20(_rewardToken).transferFrom(
            address(this),
            receipt,
            rewards
        );
        emit RewardExtracted(rewards, receipt);
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
            uint128 cycle = decodeCycle(tokenIds[i]);
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
                    amounts[i] * _roundToTokenCost[decodeRound(tokenIds[i])],
                    _adjustments[i]
                );
            }
        }
        // pay cost
        ERC20(_costToken).transferFrom(
            msg.sender,
            address(this),
            totalCost
        );
        // withdraw reward coin
        ERC20(_rewardToken).transferFrom(
            address(this),
            msg.sender,
            totalReward
        );
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

    function setAdjustments(
        uint256[] calldata tokenIds,
        uint256[] calldata adjustments
    ) external onlyOwner {
        require(
            tokenIds.length == adjustments.length,
            "array length not match"
        );
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(adjustments[i] < 1000000, "invalid adjustment value");
            _adjustments[tokenIds[i]] = adjustments[i];
        }
    }

    function setCostToken(address costToken) external onlyOwner {
        _costToken = costToken;
        emit CostTokenAddressSet(costToken);
    }

    function setRewardToken(
        address rewardToken
    ) external onlyOwner {
        _rewardToken = rewardToken;
        emit RewardTokenAddressSet(rewardToken);
    }

    function lock() external onlyOwner whenNotPaused {
        _pause();
    }

    function unlock(
        uint128 billingCycle
    ) external onlyOwner whenPaused {
        _unpause();
        _lastBillingCycle = billingCycle;
        emit LastBillingCycleSet(billingCycle);
    }

    // pure functions
    function adjust(
        uint256 value,
        uint256 adjustment
    ) internal pure returns (uint256) {
        return value - value * adjustment / 1000000;
    }

    function encode(uint128 round, uint128 cycle) internal pure returns(uint256) {
        return uint256(round) << 128 + cycle;
    }

    function decodeCycle(uint256 tokenId) internal pure returns(uint128) {
        return uint128(tokenId);
    }

    function decodeRound(uint256 tokenId) internal pure returns(uint128) {
        return uint128(tokenId >> 128);
    }

    // view functions

    function getTokenStats(uint256 tokenId)
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (
            _cycleToTokenReward[decodeCycle(tokenId)],
            _roundToTokenCost[decodeRound(tokenId)],
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
