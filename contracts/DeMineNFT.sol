// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "./DeMineAgent.sol";

contract DeMineNFTCloneFactory {
    address immutable implementation;

    constructor() {
        implementation = address(new DeMineNFT());
    }

    function create(
        string memory uri,
        address royaltyRecipient,
        uint16 royaltyBps,
        address agent,
        address owner
    ) external returns(address) {
        address cloned = Clones.clone(implementation);
        DeMineNFT(cloned).initialize(
            uri,
            royaltyRecipient,
            royaltyBps,
            agent
        );
        DeMineNFT(cloned).transferOwnership(owner);
        return cloned;
    }
}

/// @author Shu Dong
contract DeMineNFT is
    ERC1155Upgradeable,
    OwnableUpgradeable,
    IERC2981Upgradeable
{
    // Events
    event TokenRoyaltySet(uint256);
    event NewPool(uint128 indexed, string);
    event Reward(uint128 indexed, uint256);
    event RewardWithOverrides(uint128, uint256, uint128[], uint256[]);
    event Redeem(address, uint256);

    address private _royaltyRecipient;
    uint16 private _royaltyBps; // EIP2981

    address private _rewardToken;
    address private _agent;

    uint128 private _nextCycle;
    uint128 private _nextPool;
    mapping(uint128 => uint256) private _reward;
    mapping(uint256 => uint256) private _overrides;

    function initialize(
        string memory uri,
        address royaltyRecipient,
        uint16 royaltyBps,
        address agent
    ) public initializer {
        __Ownable_init();
        __ERC1155_init(uri);
        _royaltyRecipient = royaltyRecipient;
        _royaltyBps = royaltyBps;
        _agent = agent;
    }

    constructor() initializer {}

    function newPool(
        string calldata info,
        uint128 startCycle,
        uint128 numCycles,
        uint256 supplyPerCycle,
        uint256 costPerToken,
        address issuer
    ) external onlyOwner {
        require(startCycle > _nextCycle, "cannot start from past");
        uint256[] memory ids = new uint256[](numCycles);
        uint256[] memory supplies = new uint256[](numCycles);
        for (uint256 i = 0; i < numCycles; i++) {
            ids[i] = (uint256(_nextPool) << 128) + i + startCycle;
            supplies[i] = supplyPerCycle;
        }
        DeMineAgent(_agent).newPool(_nextPool, issuer, costPerToken);
        _mintBatch(_agent, ids, supplies, "");
        emit NewPool(_nextPool, info);
        _nextPool += 1;
    }

    function reward(uint256 expectedRewardPerToken) external onlyOwner {
        _reward[_nextCycle] = expectedRewardPerToken;
        emit Reward(_nextCycle, expectedRewardPerToken);
        _nextCycle += 1;
    }

    function rewardWithOverrides(
        uint128 expectedRewardPerToken,
        uint128[] calldata pools,
        uint256[] calldata overrides
    ) external onlyOwner {
        require(
            pools.length == overrides.length,
            "array length mismatch"
        );
        for (uint256 i = 0; i < pools.length; i++) {
            _overrides[
                (uint256(pools[i]) << 128) + _nextCycle
            ] = overrides[i];
        }
        _reward[_nextCycle] = expectedRewardPerToken;
        emit RewardWithOverrides(
            _nextCycle,
            expectedRewardPerToken,
            pools,
            overrides
        );
        _nextCycle += 1;
    }

    function setTokenRoyaltyInfo(
        address recipient,
        uint16 bps
    ) external onlyOwner {
        _royaltyRecipient = recipient;
        _royaltyBps = bps;
        emit TokenRoyaltySet(bps);
    }

    function redeem(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        _burnBatch(_msgSender(), ids, amounts);
        uint256 totalReward;
        for (uint256 i = 0; i < ids.length; i++) {
            uint128 cycle = uint128(ids[i]);
            require(cycle < _nextCycle, "unrewarded cycle");
            totalReward += amounts[i] * (
                _overrides[ids[i]] > 0 ? _overrides[ids[i]] : _reward[cycle]
            );
        }
        if (totalReward > 0) {
            bool success = IERC20(_rewardToken).transfer(
                _msgSender(), totalReward
            );
            require(success, "failed to withdraw reward");
        }
        emit Redeem(_msgSender(), totalReward);
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
