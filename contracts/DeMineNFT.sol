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
    event MaxCyclesAllowedSet(uint256);
    event CostCoinAddressSet(address);
    event RewardCoinAddressSet(address);

    event NewRound(uint128, string, uint256, uint256, uint128, uint128);
    event Reward(uint128, uint256, uint256);
    event Locked(uint128, uint128);
    event Unlocked(uint128, uint256);
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

    struct Cycle {
        uint256 supply;
        uint256 rewardPerToken;
        uint256 costPerToken;
    }
    mapping(uint128 => Cycle) private _cycles;
    mapping(uint128 => uint256) private _roundToTokenCost; // in usd
    mapping(uint256 => uint256) private _adjustments; // token_id to adjustment

    function initialize(
        address rewardCoinAddress,
        address costCoinAddress,
        uint128 maxCyclesAllowed,
        address royaltyRecipient,
        uint16 royaltyBps
    ) public initializer {
        __ReentrancyGuard_init();
        _rewardCoinAddress = rewardCoinAddress;
        _costCoinAddress = costCoinAddress;
        _maxCyclesAllowed = maxCyclesAllowed;
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
        require(numCycles < _maxCyclesAllowed, "exceeding max period allowed");
        for (uint128 i = startCycle; i < startCycle + numCycles; i++) {
            uint256 existingCost = _cycles[i].costPerToken * _cycles[i].supply;
            _cycles[i].supply += supplyPerCycle;
            _cycles[i].costPerToken = (existingCost + costPerCycle) / _cycles[i].supply;
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
        lastBillingCycle = currentBillingCycle;
        currentBillingCycle = billingCycle;
        emit Locked(lastBillingCycle, currentBillingCycle);
    }

    function unlockBilling(uint256 soldPrice) external {
        require(locked, "not locked");
        for (uint128 i = lastBillingCycle + 1; i <= currentBillingCycle; i++) {
            _cycles[i].rewardPerToken -= _cycles[i].costPerToken / soldPrice;
            _cycles[i].costPerToken = 0;
        }
        locked = false;
        emit Unlocked(currentBillingCycle, soldPrice);
    }

    function reward(
        uint256 rewardPaid,
        uint256 expectedReward
    ) external onlyOwner nonReentrant {
        require(rewardPaid <= expectedReward, "paid too much reward");
        _cycles[_nextCycle].rewardPerToken =
            expectedReward / _cycles[_nextCycle].supply;
        ERC20(
            _rewardCoinAddress
        ).transferFrom(
            owner(),
            address(this),
            rewardPaid
        );
        emit Reward(_nextCycle, rewardPaid, expectedReward);
        _nextCycle += 1;
    }

    function withdraw(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external nonReentrant {
        require(tokenIds.length == amounts.length, "invalid input");
        uint256 totalCost;
        uint256 totalReward;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint128 cycleId = getCycleId(tokenIds[i]);
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

            uint256 expectedCost = amounts[i] * _roundToTokenCost[getRound(tokenIds[i])];
            uint256 expectedReward = amounts[i] * _cycles[cycleId].rewardPerToken;
            totalReward += adjust(expectedReward, _adjustments[i]);
            totalCost += adjust(expectedCost, _adjustments[i]);
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

    function setMaxCyclesAllowed(
        uint128 maxCyclesAllowed
    ) external onlyOwner {
        _maxCyclesAllowed = maxCyclesAllowed;
        emit MaxCyclesAllowedSet(maxCyclesAllowed);
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

    function getCycleId(
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

    function getMaxCyclesAllowed()
        external
        view
        returns (uint128)
    {
        return _maxCyclesAllowed;
    }

    function isLocked()
        external
        view
        returns (bool)
    {
        return locked;
    }

    function getTokenCost(uint256 tokenId)
        external
        view
        returns (uint256)
    {
        return _roundToTokenCost[getRound(tokenId)];
    }

    function getTokenAdjustment(uint256 tokenId)
        external
        view
        returns (uint256)
    {
        return _adjustments[tokenId];
    }

    function getCycle(uint128 cycleId)
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (
            _cycles[cycleId].supply,
            _cycles[cycleId].rewardPerToken,
            _cycles[cycleId].costPerToken
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
                        getCycleId(tokenId),
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
