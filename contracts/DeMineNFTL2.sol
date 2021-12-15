// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./ERC1155Upgradeable.sol";

contract DeMineNFTCloneFactoryL2 {
    address immutable implementation;

    constructor() {
        implementation = address(new DeMineNFTL2());
    }

    function create(
        string memory uri,
        address rewardToken,
        address costToken,
        uint16 royaltyBps
    ) external returns(address) {
        address clone = ClonesUpgradeable.clone(implementation);
        DeMineNFTL2(clone).initialize(uri, rewardToken, costToken, royaltyBps);
        return clone;
    }
}

/// @title DeMineNFT
/// @author Shu Dong
/// This smart contract enables DeMine DAO to issue new NFTs and manage value of them.
contract DeMineNFT is
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    IERC2981Upgradeable
{
    // Events
    event LogEthDeposit(address);
    event TokenRoyaltySet(uint256);
    event CostTokenAddressSet(address);
    event RewardTokenAddressSet(address);
    event LastBillingCycleSet(uint256);
    event AdjustmentSet(uint256);

    event NewPool(uint128, string, uint256);
    event Reward(uint128, uint256);
    event Locked();
    event Unlocked(uint256);
    event Withdraw(uint256, uint256);

    address private _rewardToken;
    address private _costToken;
    uint16 private _royaltyBps; // EIP2981

    uint128 public nextPool;
    uint128 public nextCycle;
    uint128 public lastBillingCycle;

    mapping(uint128 => uint256) private _cycleToTokenReward;
    mapping(uint128 => uint256) private _poolToTokenCost;
    mapping(uint256 => uint256) private _adjustments; // token_id to adjustment

    function initialize(
        string memory uri,
        address rewardToken,
        address costToken,
        address costTokenRecipient,
        uint16 royaltyBps
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ERC1155_init(uri);
        _rewardToken = rewardToken;
        _costToken = costToken;
        _royaltyBps = royaltyBps;
    }

    constructor() initializer {}

    // @notice start a new pool
    function newPool(
        string calldata infoHash,
        uint256 costPerToken,
        address recipient,
        uint256 supplyPerCycle,
        uint128 startCycle,
        uint128 numCycles
    ) external onlyOwner {
        require(startCycle > nextCycle, "invalid start cycle");
        _mintBatch(recipient, nextPool, startCycle, numCycles, supplyPerCycle);
        _poolToTokenCost[nextPool] = costPerToken;
        emit NewPool(
            pool,
            infoHash,
            costPerToken
        );
        nextPool += 1;
    }

    // @notice set reward for next cycle
    function reward(uint256 rewardPerToken) external onlyOwner {
        _cycleToTokenReward[nextCycle] = rewardPerToken;
        emit Reward(nextCycle, rewardPerToken);
        nextCycle += 1;
    }

    // @notice lock for billing, withdraw will be disabled
    function lock() external onlyOwner {
        _pause();
        bool success = IERC20(_rewardToken).approve(owner(), 2 ** 256 - 1);
        require(success, "failed to approve");
        emit Locked();
    }

    // @notice unlock the billing cycle, no cost for tokens before
    // billing cycle
    function unlock(uint128 billingCycle) external onlyOwner whenPaused {
        bool success = IERC20(_rewardToken).approve(owner(), 0);
        require(success, "failed to revoke approve");
        lastBillingCycle = billingCycle;
        _unpause();
        emit Unlocked(billingCycle);
    }

    // @notice pay cost to withdraw the reward, tokens will
    // be burned after withdraw
    function withdraw(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external whenNotPaused {
        // burn token
        _burnBatch(_msgSender(), tokenIds, amounts);
        uint256 totalCost;
        uint256 totalReward;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint128 cycle = uint128(tokenIds[i]);
            totalReward += adjust(
                amounts[i] * _cycleToTokenReward[cycle],
                _adjustments[i]
            );
            if (cycle > lastBillingCycle) {
                totalCost += adjust(
                    amounts[i] * _poolToTokenCost[uint128(tokenIds[i] >> 128)],
                    _adjustments[i]
                );
            }
        }
        // pay cost, user need to approve to pay first
        bool success = IERC20(_costToken).transferFrom(
            _msgSender(),
            owner(),
            totalCost
        );
        require(success, "failed to pay cost");
        // withdraw reward
        success = IERC20(_rewardToken).transferFrom(
            address(this),
            _msgSender(),
            totalReward
        );
        require(success, "failed to withdraw reward");
        emit Withdraw(totalReward, totalCost);
    }

    // pure functions
    function adjust(
        uint256 value,
        uint256 adjustment
    ) internal pure returns (uint256) {
        return value - value * adjustment / 1000000;
    }

    // set functions
    function setTokenRoyaltyBps(uint16 bps) external onlyOwner {
        _royaltyBps = bps;
        emit TokenRoyaltySet(bps);
    }

    function setAdjustment(
        uint128 cycle,
        uint128[] calldata pools,
        uint256[] calldata adjustments
    ) external onlyOwner {
        require(
            poolIds.length == adjustments.length,
            "array length mismatch"
        );
        for (uint256 i = 0; i < pools.length; i++) {
            uint256 tokenId = uint256(poolIds[i]) << 128 + cycle;
            _adjustments[tokenId] = adjustments[i];
        }
        emit AdjustmentSet(cycle, pools, adjustments);
    }

    function resetTokenCost(
        uint128[] calldata pools,
        uint256[] calldata costs
    ) external onlyOwner {
        for (uint256 i = 0; i < pools.length; i++) {
            _poolToTokenCost[pools[i]] = costs[i];
        }
    }

    // view functions
    function treasureSource()
        external
        view
        returns (address, address)
    {
        return (_rewardToken, _costToken);
    }

    function tokenStats(uint256 tokenId)
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (
            _cycleToTokenReward[uint128(tokenId)],
            _poolToTokenCost[uint128(tokenId >> 128)],
            _adjustments[tokenId]
        );
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address, uint256)
    {
        return (owner(), (value * _royaltyBps) / 10000);
    }
}
