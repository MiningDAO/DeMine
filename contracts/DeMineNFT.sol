// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";

/// @author Shu Dong
contract DeMineNFT is
    ERC1155Upgradeable,
    OwnableUpgradeable,
    IERC2981Upgradeable
{
    // Events
    event LogEthDeposit(address);
    event TokenRoyaltySet(uint256);
    event Reward(uint256, uint256);
    event Redeem(address, uint256);

    address private _royaltyRecipient;
    uint16 private _royaltyBps; // EIP2981

    address private _rewardToken;
    address private _nft;
    uint256 private _nextCycle;
    mapping(uint256 => uint256) private _reward;

    function initialize(
        string memory uri,
        address royaltyRecipient,
        uint16 royaltyBps
    ) public initializer {
        __Ownable_init();
        __ERC1155_init(uri);
        _royaltyRecipient = royaltyRecipient;
        _royaltyBps = royaltyBps;
    }

    constructor() initializer {}

    function mint(
        uint256 startCycle,
        uint256 numCycles,
        uint256 supplyPerCycle,
        address recipient
    ) external onlyOwner {
        require(startCycle > _nextCycle, "cannot start from past");
        uint256[] memory cycles = new uint256[](numCycles);
        uint256[] memory supplies = new uint256[](numCycles);
        for (uint256 i = 0; i < numCycles; i++) {
            cycles[i] = i + startCycle;
            supplies[i] = supplyPerCycle;
        }
        _mintBatch(recipient, cycles, supplies, "");
    }

    function reward(uint256 expectedRewardPerToken) external onlyOwner {
        _reward[_nextCycle] = expectedRewardPerToken;
        emit Reward(_nextCycle, expectedRewardPerToken);
        _nextCycle += 1;
    }

    function redeem(
        uint256[] calldata cycles,
        uint256[] calldata amounts
    ) external {
        _burnBatch(_msgSender(), cycles, amounts);
        uint256 totalReward;
        for (uint256 i = 0; i < cycles.length; i++) {
            require(cycles[i] < _nextCycle, "unrewarded cycle");
            totalReward += amounts[i] * _reward[cycles[i]];
        }
        if (totalReward > 0) {
            bool success = IERC20(_rewardToken).transfer(
                _msgSender(), totalReward
            );
            require(success, "failed to withdraw reward");
        }
        emit Redeem(_msgSender(), totalReward);
    }

    function setTokenRoyaltyInfo(
        address recipient,
        uint16 bps
    ) external onlyOwner {
        _royaltyRecipient = recipient;
        _royaltyBps = bps;
        emit TokenRoyaltySet(bps);
    }

    // view functions
    function treasureSource() external view returns (address) {
        return _rewardToken;
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address, uint256)
    {
        return (_royaltyRecipient, (value * _royaltyBps) / 10000);
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
            super.supportsInterface(interfaceId);
    }
}
