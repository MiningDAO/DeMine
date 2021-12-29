// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./DeMineNFTCloneFactory.sol";
import "./IDeMineNFTAdmin.sol";
import "./IDeMineNFT.sol";

contract DeMineNFTAdminTest is IDeMineNFTAdmin {
    event Redeem(address, uint256, uint256, uint256[], uint256[]);
    function redeem(
        address sender,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external override {
        emit Redeem(sender, 1, 1, tokenIds, amounts);
    }
}

contract DeMineNFTAdmin is
    OwnableUpgradeable,
    IDeMineNFTAdmin
{
    event NewPool(uint128, string, uint256);
    event March(uint128, uint128);
    event Reward(uint128, uint256);
    event RewardWithAdjustment(uint128, uint256, uint128[], uint256[]);
    event PoolCostReset(uint128, uint256);
    event PoolCostResetBatch(uint128[], uint256[]);
    event LastBillingCycleSet(uint128, uint128);
    event Redeem(address, uint256, uint256, uint256[], uint256[]);

    address private _rewardToken;
    address private _costToken;
    address private _costRecipient;

    uint128 private _nextCycle;
    uint128 private _nextPool;

    address private _nft;
    uint128 private _billingPeriod;
    uint128 private _lastBillingRound;

    // billing cycle to reward token sold price in cost token
    mapping(uint128 => uint256) private _soldPrice;
    // cycle to reward ERC20 token per NFT
    mapping(uint128 => uint256) private _rewardPerNFT;
    // pool to cost ERC20 token per NFT
    mapping(uint128 => uint256) private _costPerNFT;
    // NFT id to adjustment, base is 100000000
    mapping(uint256 => uint256) private _adjustments;

    function initialize(
        uint128 billingPeriod,
        address nft,
        address rewardToken,
        address costToken,
        address costRecipient
    ) public initializer {
        __Ownable_init();
        _billingPeriod = billingPeriod;
        _nft = nft;
        _rewardToken = rewardToken;
        _costToken = costToken;
        _costRecipient = costRecipient;
    }

    constructor() initializer {}

    function newPool(
        string calldata infoHash,
        uint256 costPerToken,
        uint128 startCycle,
        uint128 numCycles,
        uint256 supplyPerCycle,
        address recipient
    ) external onlyOwner {
        require(startCycle > _nextCycle, "cannot start from past");
        uint256[] memory NFTIds = new uint256[](numCycles);
        uint256[] memory supplies = new uint256[](numCycles);
        for (uint128 i = 0; i < numCycles; i++) {
            NFTIds[i] = (
                uint256(_nextPool) << 128
            ) + startCycle + i;
            supplies[i] = supplyPerCycle;
        }
        IDeMineNFT(_nft).mint(recipient, NFTIds, supplies);
        _costPerNFT[_nextPool] = costPerToken;
        emit NewPool(_nextPool, infoHash, costPerToken);
        _nextPool += 1;
    }

    function march(uint128 cycles) external onlyOwner {
        emit March(_nextCycle, _nextCycle + cycles);
        _nextCycle += cycles;
    }

    function reward(
        uint256 expectedRewardPerToken
    ) external onlyOwner {
        _rewardPerNFT[_nextCycle] = expectedRewardPerToken;
        emit Reward(_nextCycle, expectedRewardPerToken);
        _nextCycle += 1;
    }

    function rewardWithAdjustment(
        uint128 expectedRewardPerToken,
        uint128[] calldata pools,
        uint256[] calldata adjustments
    ) external onlyOwner {
        require(
            pools.length == adjustments.length,
            "array length mismatch"
        );
        for (uint256 i = 0; i < pools.length; i++) {
            _adjustments[
                (uint256(pools[i]) << 128) + _nextCycle
            ] = adjustments[i];
        }
        _rewardPerNFT[_nextCycle] = expectedRewardPerToken;
        emit RewardWithAdjustment(
            _nextCycle,
            expectedRewardPerToken,
            pools,
            adjustments
        );
        _nextCycle += 1;
    }

    function settlePrep() external onlyOwner {
        require(
            (_lastBillingRound + 1) * _billingPeriod < _nextCycle,
            "billing too early"
        );
        IDeMineNFT(_nft).pause();
        bool success = IERC20(_rewardToken).approve(owner(), 2 ** 256 - 1);
        require(success, "failed to approve");
    }

    function settle(uint256 rewardTokenPrice) external onlyOwner {
        IDeMineNFT(_nft).unpause();
        bool success = IERC20(_rewardToken).approve(owner(), 0);
        require(success, "failed to revoke approve");
        _lastBillingRound += 1;
        _soldPrice[_lastBillingRound] = rewardTokenPrice;
        emit LastBillingCycleSet(_lastBillingRound, _billingPeriod);
    }

    function redeem(
        address sender,
        uint256[] calldata NFTIds,
        uint256[] calldata amounts
    ) external override {
        require(msg.sender == _nft, "disallowed caller");
        (uint256 totalReward, uint256 totalCost) = aggregate(NFTIds, amounts);
        bool success;
        // pay cost, user need to approve to pay first
        if (totalCost > 0) {
            success = IERC20(_costToken).transferFrom(
                sender,
                _costRecipient,
                totalCost
            );
            require(success, "failed to pay cost");
        }
        // redeem reward
        if (totalReward > 0) {
            success = IERC20(_rewardToken).transferFrom(
                address(this),
                sender,
                totalReward
            );
            require(success, "failed to withdraw reward");
        }
        emit Redeem(sender, totalReward, totalCost, NFTIds, amounts);
    }

    // view functions
    function treasureSource()
        external
        view
        returns (address, address)
    {
        return (_rewardToken, _costToken);
    }

    function aggregate(
        uint256[] calldata NFTIds,
        uint256[] calldata amounts
    ) public view returns(uint256, uint256) {
        uint256 totalReward;
        uint256 totalCost;
        for (uint256 i = 0; i < NFTIds.length; i++) {
            uint128 cycle = uint128(NFTIds[i]);
            uint256 rewardToken = adjustCeil(
                amounts[i] * _rewardPerNFT[cycle],
                _adjustments[NFTIds[i]]
            );
            uint256 costToken = adjust(
                amounts[i] * _costPerNFT[uint128(NFTIds[i] >> 128)],
                _adjustments[NFTIds[i]]
            );
            // cost already paid by sold reward token
            if (cycle < _lastBillingRound * _billingPeriod) {
                uint256 costed = ceil(
                    costToken,
                    _soldPrice[cycle / _billingPeriod + 1]
                );
                totalReward += (
                    rewardToken > costed ? rewardToken - costed : 0
                );
            // cost not paid yet
            } else {
                totalReward += rewardToken;
                totalCost += costToken;
            }
        }
        return (totalReward, totalCost);
    }

    function NFTStats(uint256 NFTId)
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (
            _rewardPerNFT[uint128(NFTId)],
            _costPerNFT[uint128(NFTId >> 128)],
            _adjustments[NFTId]
        );
    }

    function lastBilling() external view returns(uint128, uint128, uint256) {
        return (
            _lastBillingRound,
            _billingPeriod,
            _soldPrice[_lastBillingRound]
        );
    }

    // pure functions
    function adjust(
        uint256 value,
        uint256 adjustment
    ) internal pure returns (uint256) {
        return value - value * adjustment / 100000000;
    }

    function adjustCeil(
        uint256 value,
        uint256 adjustment
    ) internal pure returns (uint256) {
        uint256 adjusted = ceil(value * adjustment, 100000000);
        return value > adjusted ? value - adjusted : 0;
    }

    function ceil(uint256 a, uint256 m) internal pure returns (uint256) {
        return (a + m - 1) / m;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure returns(bool) {
        return interfaceId == type(IDeMineNFTAdmin).interfaceId;
    }
}
