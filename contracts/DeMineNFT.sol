// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
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
    event MaxPeriodSet(uint256);

    event NewRound(uint256, string, uint256, uint256, uint256);
    event Reward(uint256, uint256, uint256);
    event Locked(uint256, uint256);
    event Unlocked(uint256, uint256);
    event Withdraw(uint256, uint256);

    address private _rewardCoinAddress;
    address private _costCoinAddress;
    uint256 private _nextCycle;
    uint256 private _nextRound;
    uint256 private _maxPeriod; // 36 cycles

    // EIP2981
    struct TokenRoyalty {
        address recipient;
        uint16 bps;
    }
    TokenRoyalty private _tokenRoyalty;

    struct Cycle {
        uint256 supply;
        uint256 expectedReward;
        uint256 expectedCost
    }
    map(uint256 => Cycle) private _cycles; // cycle id to Cycles
    map(uint256 => uint256) private _roundToTokenCost; // round to cost per token in usd
    map(uint256 => uint256) private _adjustments; // token_id to override ratio
    uint256 private _adjustmentDecimals;

    struct Lock {
        bool locked,
        uint256 lastBillingCycle,
        uint256 billingCycle
    }
    Lock public lock;

    function initialize(
        address rewardCoinAddress,
        address costCoinAddress,
        address _royaltyRecipient,
        uint16 _royaltyBPS,
        uint256 maxPeroid,
        uint256 adjustmentDecimals,
    ) public initializer {
        __Ownable_init__();
        ____ERC1155_init__("");
        __ReentrancyGuard_init();
        _rewardCoinAddress = rewardCoinAddress;
        _costCoinAddress = costCoinAddress;
        _maxPeriod = maxPeriod;
        _adjustmentDecimals = adjustmentDecimals;
        tokenRoyalty = TokenRoyalty(_royaltyRecipient, _royaltyBPS);
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
        string infoHash,
        uint256 startCycle,
        uint256 numCycles,
        uint256 supplyPerCycle,
        uint256 costPerCycle
    ) external onlyOwner {
        require(numCycles < _maxPeriod, "exceeding max period allowed");
        for (uint256 i = startCycle; i < startCycle + numCycles; i++) {
            _cycles[i].supply += supplyPerCycle;
            _cycles[i].expectedCost += costPerCycle;
            _mint(owner(), tokenId(_nextRound, i), supplyPerCycle, "");
        }
        _roundToTokenCost[_nextRound] = costPerCycle / supplyPerCycle;
        emit NewRound(
            _nextRound,
            startCycle,
            numCycles,
            infoHash,
            supplyPerCycle,
            costPerToken,
        );
        _nextRound += 1;
    }

    function lockBilling(uint256 billingCycle) external {
        require(
            !lock.locked && billingCycle > lock.lastBillingCycle,
            "already locked or wrong billing cycle"
        );
        lock.locked = true;
        lock.lastBillingCycle = lock.billingCycle;
        lock.billingCycle = billingCycle;
        emit Locked(lock.lastBillingCycle, lock.billingCycle);
    }

    function unlockBilling(uint256 soldPrice) external {
        require(lock.locked, "not locked");
        for (uint256 i = lock.lastBillingCycle + 1; i <= billingCycle; i++) {
            sold = _cycles[i].expectedCost / soldPrice;
            _cycles[i].expectedReward -= sold;
            _cycles[i].expectedCost = 0;
        }
        locked.locked = false;
        emit Unlocked(lock.billingCycle, soldPrice);
    }

    function reward(
        uint256 reward,
        uint256 expectedReward,
        uint256[] calldata tokenIds,
        uint256[] calldata overrides
    ) external onlyOwner nonReentrant {
        _cycles[_nextCycle].expectedReward = expectedReward;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _token_overrides[tokenIds[i]] = overrides[i];
        }
        ERC20(
            _rewardCoinAddress
        ).transferFrom(
            owner(),
            address(this),
            reward
        );
        emit Reward(_nextCycle, expectedReward, reward);
        _nextCycle += 1;
    }

    function withdraw(
        uint256[] calldata tokenIds;
        uint256[] calldata amounts
    ) external nonReentrant {
        require(tokenIds.length == amounts.length, "invalid input");
        uint256 totalCost;
        uint256 totalReward;
        for (int i = 0; i < tokenIds.length; i++) {
            cycle_id = cycleId(tokenIds[i]);
            require(
                !lock.locked ||
                cycle_id <= lock.lastBillingCycle ||
                cycle_id > lock.billingCycle,
                "tokens locked"
            ),
            // burn token
            _safeTransferFrom(
                msg.sender(),
                address(0x0),
                nft_ids[i],
                amounts[i],
                ""
            );

            cycle = _cycles[cycle_id];
            expectedReward = amounts[i] * cycle.expectedReward / cycle.supply;
            expectedCost = amounts[i] * _roundToTokenCost[round(tokenIds[i])];
            cycle.supply = sub(cycle.supply - amounts[i]);
            cycle.expectedReward -= expectedReward;
            cycle.expectedCost -= expectedCost;

            uint256 base = 10**_adjustmentDecimals;
            totalReward += expectedReward * (base - _adjustments[i]) / base;
            totalCost += expectedCost * (base - _adjustments[i]) / base;
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
        emit WithDraw(totalReward, totalCost);
    }

    // set functions
    function setTokenRoyalty(address recipient, uint16 bps) external onlyOwner {
        _tokenRoyalty = TokenRoyalty(recipient, bps);
        emit TokenRoyaltySet(recipient, bps);
    }

    function setMaxPeriod(uint256 maxPeriod) external onlyOwner {
        _maxPeriod = maxPeriod;
        emit MaxPeriodSet(maxPeriod);
    }

    // pure functions
    function tokenId(uint256 round, uint256 cycleId) pure returns uint256 {
        return round * 100000000000 + cycleId;
    }

    function round(uint256 tokenId) pure returns uint256 {
        return tokenId / 100000000000;
    }

    function cycleId(uint256 tokenId) pure returns uint256 {
        return tokenId % 100000000000;
    }

    // view functions to query state
    function getNextCycle() external view {
        return _nextCycle;
    }

    function getNextRound() external view {
        return _nextRound;
    }

    function getMaxPeriod() external view {
        return _maxPeriod;
    }

    function getAdjustmentDecimals() external view {
        return _adjustmentDecimals;
    }

    function getTokenCost(uint256 tokenId) external view {
        round = round(tokenId),
        cycle = _cycles[cycleId(tokenId)]
        expected_reward = cycle.expected_reward / cycle.supply;
        expected_cost = _roundToTokenCost[round],
        adjustment = _adjustments[tokenId],
        return (expected_reward, expected_cost, adjustment);
    }

    function getCycle(uint256 cycleId) external view {
        return _cycles[cycleId];
    }

    /// @notice returns the uri metadata. Used by marketplaces and wallets to show the NFT
    function uri(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{ "name": "',
                        DeMine Redemption Token,
                        '", ',
                        '"description" : ',
                        '"Token to redeem your mined coins for round "',
                        round(tokenId),
                        '" at cycle "',
                        cycleId(tokenId),
                        '", ',
                        '"image": "ipfs://QmQWipu2KsBJ1pA3Q9vQBj77bgVSz86KrmavaCr7Y2p8s3" }',
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function royaltyInfo(uint256 _tokenId, uint256 value)
        public
        view
        override
        returns (address, uint256)
    {
        if (_tokenRoyalty.recipient != address(0) && _tokenRoyalty.bps != 0) {
            return (
                _tokenRoyalty.recipient,
                (value * _tokenRoyalty.bps) / 10000
            );
        }
        return (address(0), 0);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155)
        returns (bool)
    {
        return
            interfaceId == type(IERC2981Upgradeable).interfaceId ||
            interfaceId == type(IERC1155Upgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }
};
