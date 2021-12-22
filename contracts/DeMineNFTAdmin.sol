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
    event LogEthDeposit(address);
    event NewPool(uint128, string, uint128, uint128, uint256);
    event CycleFinalized(uint128, uint256);
    event AdjustmentSet(uint128, uint128[], uint256[]);
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
    uint128 private _lastBillingCycle;

    // billing cycle to reward token sold price in cost token
    mapping(uint128 => uint256) private _soldPrice;
    // cycle to reward ERC20 token per NFT
    mapping(uint128 => uint256) private _rewardPerNFT;
    // pool to cost ERC20 token per NFT
    mapping(uint128 => uint256) private _costPerNFT;
    // NFT id to adjustment, base is 1000000
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
        uint256[] memory NFTIds = new uint256[](numCycles);
        uint256[] memory supplies = new uint256[](numCycles);
        for (uint128 i = 0; i < numCycles; i++) {
            NFTIds[i] = uint256(_nextPool) << 128 + startCycle + i;
            supplies[i] = supplyPerCycle;
        }
        IDeMineNFT(_nft).mint(recipient, NFTIds, supplies);
        _costPerNFT[_nextPool] = costPerToken;
        emit NewPool(_nextPool, infoHash, startCycle, numCycles, supplyPerCycle);
        _nextPool += 1;
    }

    function finalizeCycle(
        uint128 expectedRewardPerToken
    ) public onlyOwner {
        _rewardPerNFT[_nextCycle] = expectedRewardPerToken;
        emit CycleFinalized(_nextCycle, expectedRewardPerToken);
        _nextCycle += 1;
    }

    function finalizeCycleWithAdjustment(
        uint128 expectedRewardPerToken,
        uint128[] calldata pools,
        uint256[] calldata adjustments
    ) external onlyOwner {
        require(
            pools.length == adjustments.length,
            "array length mismatch"
        );
        for (uint256 i = 0; i < pools.length; i++) {
            require(adjustments[i] <= 1000000, "invalid adjustment");
            _adjustments[uint256(pools[i]) << 128 + _nextCycle] = adjustments[i];
        }
        emit AdjustmentSet(_nextCycle, pools, adjustments);
        finalizeCycle(expectedRewardPerToken);
    }

    function lock() external onlyOwner {
        require(
            _lastBillingCycle + _billingPeriod <  _nextCycle,
            "billing too early"
        );
        IDeMineNFT(_nft).pause();
        bool success = IERC20(_rewardToken).approve(owner(), 2 ** 256 - 1);
        require(success, "failed to approve");
    }

    function unlock(uint256 rewardTokenPrice) external onlyOwner {
        IDeMineNFT(_nft).unpause();
        bool success = IERC20(_rewardToken).approve(owner(), 0);
        require(success, "failed to revoke approve");
        _lastBillingCycle += _billingPeriod;
        _soldPrice[_lastBillingCycle] = rewardTokenPrice;
        emit LastBillingCycleSet(
            _lastBillingCycle,
            _billingPeriod
        );
    }

    function redeem(
        address sender,
        uint256[] calldata NFTIds,
        uint256[] calldata amounts
    ) external override {
        require(msg.sender == _nft, "disallowed caller");
        (uint256 reward, uint256 cost) = aggregate(NFTIds, amounts);
        bool success;
        // pay cost, user need to approve to pay first
        if (cost > 0) {
            success = IERC20(_costToken).transferFrom(
                sender,
                _costRecipient,
                cost
            );
            require(success, "failed to pay cost");
        }
        // redeem reward
        if (reward > 0) {
            success = IERC20(_rewardToken).transferFrom(
                address(this),
                sender,
                reward
            );
            require(success, "failed to withdraw reward");
        }
        emit Redeem(sender, reward, cost, NFTIds, amounts);
    }

    function resetPoolCost(
        uint128 pool,
        uint256 cost
    ) external onlyOwner {
        require(
            cost < _costPerNFT[pool],
            "no one should increase the cost"
        );
        _costPerNFT[pool] = cost;
        emit PoolCostReset(pool, cost);
    }

    function batchResetPoolCost(
        uint128[] calldata pools,
        uint256[] calldata costs
    ) external onlyOwner {
        require(pools.length == costs.length, "array length mismatch");
        for (uint256 i = 0; i < pools.length; i++) {
            require(
                costs[i] < _costPerNFT[pools[i]],
                "no one should increase the cost"
            );
            _costPerNFT[pools[i]] = costs[i];
        }
        emit PoolCostResetBatch(pools, costs);
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
            uint256 reward = adjust(
                amounts[i] * _rewardPerNFT[cycle],
                _adjustments[i]
            );
            uint256 cost = adjust(
                amounts[i] * _rewardPerNFT[cycle],
                _adjustments[i]
            );
            if (cycle > _lastBillingCycle) { // cost not paid yet
                totalReward += reward;
                totalCost += cost;
            } else { // cost already paid by selling reward token
                totalReward += (
                    reward - cost / _soldPrice[cycle - cycle % _billingPeriod]
                );
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

    // pure functions
    function adjust(
        uint256 value,
        uint256 adjustment
    ) internal pure returns (uint256) {
        return value - value * adjustment / 1000000;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure returns(bool) {
        return interfaceId == type(IDeMineNFTAdmin).interfaceId;
    }
}
