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

    event NewSupply(uint128, string, uint256);
    event Reward(uint128, uint256, uint256[], uint256[]);
    event Locked();
    event Unlocked(uint256);
    event Withdraw(uint256, uint256);

    address private _rewardToken;
    address private _costToken;
    uint128 private _lastBillingCycle;

    // EIP2981
    address private _royaltyRecipient;
    uint16 private _royaltyBps;

    mapping(uint128 => uint256) private _cycleToTokenReward;
    mapping(uint128 => uint256) private _poolToTokenCost;
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

    // @notice no one should send ether to this contract,
    // but if anyone does, we should take the money to
    // save these ethers
    function raidTheCoffers() external onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = owner().call{value: amount}("");
        require(success, "maybe it's not your money");
    }

    // @notice start a new pool
    function newSupply(
        uint128 pool,
        string calldata infoHash,
        uint256[] calldata tokenIds,
        uint256[] calldata supplys,
        uint256 costPerToken
    ) external onlyOwner whenNotPaused {
        _mintBatch(owner(), tokenIds, supplys, "");
        _poolToTokenCost[pool] = costPerToken;
        emit NewSupply(
            pool,
            infoHash,
            costPerToken
        );
    }

    // @notice set reward and adjustment for cycle
    function reward(
        uint128 cycle,
        uint256 rewardPerToken,
        uint256[] calldata tokenIds,
        uint256[] calldata adjustments
    ) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _adjustments[tokenIds[i]] = adjustments[i];
        }
        _cycleToTokenReward[cycle] = rewardPerToken;
        emit Reward(
            cycle,
            rewardPerToken,
            tokenIds,
            adjustments
        );
    }

    // @notice lock for billing, withdraw function will
    // be disabled
    function lock() external onlyOwner whenNotPaused {
        _pause();
        bool success = ERC20(_rewardToken).approve(owner(), 2 ** 256 - 1);
        require(success, "failed to approve");
        emit Locked();
    }

    // @notice unlock the billing cycle, no cost for tokens before
    // billing cycle
    function unlock(uint128 billingCycle) external onlyOwner whenPaused {
        bool success = ERC20(_rewardToken).approve(owner(), 0);
        require(success, "failed to revoke approve");
        _lastBillingCycle = billingCycle;
        _unpause();
        emit Unlocked(billingCycle);
    }

    // @notice pay cost to withdraw the reward, tokens will
    // be burned after withdraw
    function withdraw(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external nonReentrant whenNotPaused {
        _safeBatchTransferFrom(
            _msgSender(),
            address(0x0),
            tokenIds,
            amounts,
            ""
        );
        uint256 totalCost;
        uint256 totalReward;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint128 cycle = uint128(tokenIds[i]);
            // burn token
            totalReward += adjust(
                amounts[i] * _cycleToTokenReward[cycle],
                _adjustments[i]
            );
            if (cycle > _lastBillingCycle) {
                totalCost += adjust(
                    amounts[i] * _poolToTokenCost[uint128(tokenIds[i] >> 128)],
                    _adjustments[i]
                );
            }
        }
        // pay cost, user need to approve to pay first
        bool success = ERC20(_costToken).transferFrom(
            _msgSender(),
            address(this),
            totalCost
        );
        require(success, "failed to pay cost");
        // withdraw reward
        success = ERC20(_rewardToken).transferFrom(
            address(this),
            _msgSender(),
            totalReward
        );
        require(success, "failed to withdraw reward");
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
        uint128[] calldata pools,
        uint256[] calldata costs
    ) external onlyOwner {
        for (uint256 i = 0; i < pools.length; i++) {
            _poolToTokenCost[pools[i]] = costs[i];
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
        return (
            _royaltyRecipient,
            (value * _royaltyBps) / 10000
        );
    }
}
