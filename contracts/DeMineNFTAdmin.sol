// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./DeMineNFTCloneFactory.sol";
import "./IDeMineNFTAdmin.sol";
import "./IDeMineNFT.sol";

contract DeMineNFTAdmin is
    OwnableUpgradeable,
    PausableUpgradeable,
    IDeMineNFTAdmin
{
    event LogEthDeposit(address);
    event NewPool(uint128, string, uint128, uint128, uint256);
    event CycleFinalized(uint128, uint256);
    event CycleFinalizedWithAdjustment(uint128, uint256, uint128[], uint256[]);
    event PoolCostReset(uint128, uint256);
    event PoolCostResetBatch(uint128[], uint256[]);
    event LastBillingCycleSet(uint128, uint128);
    event Redeem(address, uint256, uint256, uint256[], uint256[]);

    address private _rewardToken;
    address private _costToken;
    address private _costRecipient;

    uint128 private _nextCycle;
    uint128 private _nextPool;

    address public nft;
    uint128 public billingPeriod;
    uint128 public lastBillingCycle;

    // billing cycle to reward token sold price to pay bill
    mapping(uint128 => uint256) private _sellingPrice;
    // cycle to reward ERC20 token per NFT
    mapping(uint128 => uint256) private _rewardPerNFT;
    // pool to cost ERC20 token per NFT
    mapping(uint128 => uint256) private _costPerNFT;
    // NFT id to adjustment, base is 1000000
    mapping(uint256 => uint256) private _adjustments;

    function initialize(
        uint128 _billingPeriod,
        address _nft,
        address rewardToken,
        address costToken,
        address costRecipient
    ) public initializer {
        __Ownable_init();
        billingPeriod = _billingPeriod;
        nft = _nft;
        _rewardToken = rewardToken;
        _costToken = costToken;
        _costRecipient = costRecipient;
    }

    constructor() initializer {}

    fallback() external payable {
      emit LogEthDeposit(_msgSender());
    }

    receive() external payable {
      emit LogEthDeposit(_msgSender());
    }

    function getRoyalty() external onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = owner().call{value: amount}("");
        require(success, "failed to extract");
    }

    function newPool(
        string calldata infoHash,
        uint256 costPerToken,
        uint128 startCycle,
        uint128 numCycles,
        uint256 supplyPerCycle,
        address recipient
    ) external {
        uint256[] memory NFTIds = new uint256[](numCycles);
        uint256[] memory supplies = new uint256[](numCycles);
        for (uint128 i = 0; i < numCycles; i++) {
            NFTIds[i] = uint256(_nextPool) << 128 + startCycle + i;
            supplies[i] = supplyPerCycle;
        }
        IDeMineNFT(nft).mint(recipient, NFTIds, supplies);
        _costPerNFT[_nextPool] = costPerToken;
        emit NewPool(_nextPool, infoHash, startCycle, numCycles, supplyPerCycle);
        _nextPool += 1;
    }

    function finalizeCycle(uint128 expectedRewardPerToken) external onlyOwner {
        _rewardPerNFT[_nextCycle] = expectedRewardPerToken;
        _nextCycle += 1;
        emit CycleFinalized(_nextCycle, expectedRewardPerToken);
    }

    function finalizeCycleWithAdjustment(
        uint128 expectedRewardPerToken,
        uint128[] calldata pools,
        uint256[] calldata adjustments
    ) external {
        require(
            pools.length == adjustments.length,
            "array length mismatch"
        );
        for (uint256 i = 0; i < pools.length; i++) {
            require(adjustments[i] <= 1000000, "invalid adjustment");
            _adjustments[uint256(pools[i]) << 128 + _nextCycle] = adjustments[i];
        }
        _rewardPerNFT[_nextCycle] = expectedRewardPerToken;
        emit CycleFinalizedWithAdjustment(_nextCycle, expectedRewardPerToken, pools, adjustments);
        _nextCycle += 1;
    }

    function pause() external onlyOwner whenNotPaused {
        require(
            lastBillingCycle + billingPeriod <  _nextCycle,
            "billing too early"
        );
        _pause();
        IDeMineNFT(nft).pause();
        bool success = IERC20(_rewardToken).approve(owner(), 2 ** 256 - 1);
        require(success, "failed to approve");
    }

    function unpause(
        uint128 _lastBillingCycle, // for sanity check
        uint256 rewardTokenPrice
    ) external onlyOwner whenPaused {
        require(
            lastBillingCycle == _lastBillingCycle,
            "wrong billing to unlock"
        );
        bool success = IERC20(_rewardToken).approve(owner(), 0);
        require(success, "failed to revoke approve");
        lastBillingCycle += billingPeriod;
        _sellingPrice[lastBillingCycle] = rewardTokenPrice;
        IDeMineNFT(nft).unpause();
        _unpause();
        emit LastBillingCycleSet(_lastBillingCycle, lastBillingCycle);
    }

    function redeem(
        address sender,
        uint256[] calldata NFTIds,
        uint256[] calldata amounts
    ) external override {
        require(msg.sender == nft, "disallowed caller");
        (uint256 reward, uint256 cost) = aggregate(NFTIds, amounts);
        bool success;
        // pay cost, user need to approve to pay first
        if (cost > 0) {
            success = IERC20(_costToken).transferFrom(
                sender,
                address(this),
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
            if (cycle > lastBillingCycle) { // cost not paid yet
                totalReward += reward;
                totalCost += cost;
            } else { // cost already paid by selling reward token
                totalReward += (
                    reward - cost / _sellingPrice[cycle - cycle % billingPeriod]
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
