// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "./Base64.sol";

/// @notice Error library for centralised error messaging
library Errors {
    string constant invalidMembershipId = "Unknown Membership NFT ID";
}

/// @title DeMineNFT
/// @author Shu Dong
/// This smart contract enables DeMine DAO to issue new NFTs and manage value of them.
contract DeMineNFT is
    Initializable,
    UUPSUpgradeable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IERC2981Upgradeable
{
    // Events
    event LogEthDeposit(address);
    event TokenRoyaltySet(address, uint256);
    event CostCoinAddressSet(address);
    event RewardCoinAddressSet(address);

    event NewRound(uint128, string, uint256, uint256, uint128, uint128);
    event Reward(uint128, address, uint256, uint256);
    event RewardExtracted(uint256, address);
    event Locked(uint128, uint128);
    event Unlocked(uint128);
    event Withdraw(uint256, uint256);

    address private _rewardCoinAddress;
    address private _costCoinAddress;
    uint128 private _nextCycle;
    uint128 private _nextRound;
    uint128 private _maxCyclesAllowed;

    // EIP2981
    address private _royaltyRecipient;
    uint16 private _royaltyBps;

    // lock for billing
    bool private locked;
    uint128 private lastBillingCycle;
    uint128 private currentBillingCycle;

    mapping(uint128 => uint256) private _cycleToTokenReward;
    mapping(uint128 => uint256) private _roundToTokenCost;
    mapping(uint256 => uint256) private _adjustments; // token_id to adjustment

    function initialize(
        address rewardCoinAddress,
        address costCoinAddress,
        address royaltyRecipient,
        uint16 royaltyBps
    ) public initializer {
        __ReentrancyGuard_init();
        _rewardCoinAddress = rewardCoinAddress;
        _costCoinAddress = costCoinAddress;
        _royaltyRecipient = royaltyRecipient;
        _royaltyBps = royaltyBps;
    }

    constructor() initializer {}

    function _authorizeUpgrade(address) internal override onlyOwner {}

    fallback() external payable {
        emit LogEthDeposit(_msgSender());
    }

    receive() external payable {
        emit LogEthDeposit(_msgSender());
    }

    function newRound(
        string calldata infoHash,
        uint256 supplyPerCycle,
        uint256 costPerCycle,
        uint128 startCycle,
        uint128 numCycles
    ) external onlyOwner {
        require(numCycles < 1500, "exceeding max period allowed");
        for (uint128 i = startCycle; i < startCycle + numCycles; i++) {
            _mint(owner(), getTokenId(_nextRound, i), supplyPerCycle, "");
        }
        _roundToTokenCost[_nextRound] = costPerCycle / supplyPerCycle;
        emit NewRound(
            _nextRound,
            infoHash,
            supplyPerCycle,
            costPerCycle,
            startCycle,
            numCycles
        );
        _nextRound += 1;
    }

    function lockBilling(uint128 billingCycle) external {
        require(
            !locked && billingCycle > lastBillingCycle,
            "already locked or wrong billing cycle"
        );
        locked = true;
        currentBillingCycle = billingCycle;
        emit Locked(lastBillingCycle, currentBillingCycle);
    }

    function unlockBilling(
        uint256[] calldata rewardTokenSold
    ) external {
        require(locked, "not locked or invalid array length");
        for (uint128 i = 0; i <= rewardTokenSold.length; i++) {
            _cycleToTokenReward[lastBillingCycle + 1 + i] -= rewardTokenSold[i];
        }
        locked = false;
        lastBillingCycle = currentBillingCycle;
        emit Unlocked(currentBillingCycle);
    }

    function reward(
        address payer,
        uint256 totalRewardPaid,
        uint256 rewardPerToken
    ) external onlyOwner nonReentrant {
        _cycleToTokenReward[_nextCycle] = rewardPerToken;
        ERC20(
            _rewardCoinAddress
        ).transferFrom(
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
    ) external onlyOwner {
        ERC20(
            _rewardCoinAddress
        ).transferFrom(
            address(this),
            receipt,
            rewards
        );
        emit RewardExtracted(rewards, receipt);
    }

    function withdraw(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external nonReentrant {
        require(tokenIds.length == amounts.length, "invalid input");
        uint256 totalCost;
        uint256 totalReward;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint128 cycleId = getCycle(tokenIds[i]);
            require(
                !locked ||
                cycleId <= lastBillingCycle ||
                cycleId > currentBillingCycle,
                "tokens locked"
            );
            // burn token
            _safeTransferFrom(
                msg.sender,
                address(0x0),
                tokenIds[i],
                amounts[i],
                ""
            );

            totalReward += adjust(
                amounts[i] * _cycleToTokenReward[cycleId],
                _adjustments[i]
            );
            if (cycleId > lastBillingCycle) {
                totalCost += adjust(
                    amounts[i] * _roundToTokenCost[getRound(tokenIds[i])],
                    _adjustments[i]
                );
            }
        }
        // pay cost
        ERC20(_costCoinAddress).transferFrom(
            msg.sender,
            address(this),
            totalCost
        );
        // withdraw reward coin
        ERC20(_rewardCoinAddress).transferFrom(
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

    function setAdjustments(
        uint256[] calldata tokenIds,
        uint256[] calldata adjustments
    ) external onlyOwner {
        require(
            tokenIds.length == adjustments.length,
            "invalid adjustment arrary"
        );
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(adjustments[i] < 1000000, "invalid adjustment value");
            _adjustments[tokenIds[i]] = adjustments[i];
        }
    }

    function resetTokenCost(
        uint128[] calldata round,
        uint256[] calldata cost
    ) external onlyOwner {
        require(round.length == cost.length, "invalid array length");
        for (uint256 i = 0; i < round.length; i++) {
            _roundToTokenCost[round[i]] = cost[i];
        }
    }

    function setCostCoinAddress(address costCoinAddress) external onlyOwner {
        _costCoinAddress = costCoinAddress;
        emit CostCoinAddressSet(costCoinAddress);
    }

    function setRewardCoinAddress(
        address rewardCoinAddress
    ) external onlyOwner {
        _rewardCoinAddress = rewardCoinAddress;
        emit RewardCoinAddressSet(rewardCoinAddress);
    }

    // pure functions
    function getTokenId(
        uint128 round,
        uint128 cycleId
    ) public pure returns (uint256) {
        return uint256(round) << 32 + cycleId;
    }

    function getRound(
        uint256 tokenId
    ) public pure returns (uint128) {
        return uint128(tokenId >> 32);
    }

    function getCycle(
        uint256 tokenId
    ) public pure returns (uint128) {
        return uint128(tokenId);
    }

    function adjust(
        uint256 value,
        uint256 adjustment
    ) internal pure returns (uint256) {
        return value * (1000000 - adjustment) / 1000000;
    }

    // view functions to query state
    function getNextCycle()
        external
        view
        returns (uint128)
    {
        return _nextCycle;
    }

    function getNextRound()
        external
        view
        returns (uint128)
    {
        return _nextRound;
    }

    function isLocked()
        external
        view
        returns (bool)
    {
        return locked;
    }

    function getTokenStats(uint256 tokenId)
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (
            _cycleToTokenReward[getCycle(tokenId)],
            _roundToTokenCost[getRound(tokenId)],
            _adjustments[tokenId]
        );
    }

    /// @notice returns the uri metadata. Used by marketplaces and wallets to show the NFT
    function uri(uint256 tokenId)
        public
        pure
        override
        returns (string memory)
    {
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{ "name": "DeMine Redemption Token",',
                        '"description" : ',
                        '"Token to redeem your mined coins for round "',
                        getRound(tokenId),
                        '" at cycle "',
                        getCycle(tokenId),
                        '", "',
                        '"image": "ipfs://QmQWipu2KsBJ1pA3Q9vQBj77bgVSz86KrmavaCr7Y2p8s3" }'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address, uint256)
    {
        if (_royaltyRecipient != address(0) && _royaltyBps != 0) {
            return (
                _royaltyRecipient,
                (value * _royaltyBps) / 10000
            );
        }
        return (address(0), 0);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155Upgradeable, IERC165Upgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IERC2981Upgradeable).interfaceId ||
            interfaceId == type(IERC1155Upgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
