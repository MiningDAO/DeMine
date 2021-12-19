// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./DeMineNFTAdmin.sol";

contract DeMineNFTCloneFactory {
    address immutable implementation;

    constructor() {
        implementation = address(new DeMineNFT());
    }

    function create(
        string memory uri,
        uint16 royaltyBps,
        address owner
    ) external returns(address) {
        address cloned = ClonesUpgradeable.clone(implementation);
        DeMineNFT(cloned).initialize(uri, royaltyBps);
        DeMineNFT(cloned).transferOwnership(owner);
        return cloned;
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
    event Redeem(address, uint256, uint256);

    uint16 private _royaltyBps; // EIP2981

    function initialize(
        string memory uri,
        uint16 royaltyBps
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ERC1155_init(uri);
        _royaltyBps = royaltyBps;
    }

    constructor() initializer {}

    // @notice start a new pool
    function mint(
        address recipient,
        uint256[] memory tokenIds,
        uint256[] memory supplies
    ) external onlyOwner {
        _mintBatch(recipient, tokenIds, supplies, "");
    }

    function pause() external onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() external onlyOwner whenPaused {
        _unpause();
    }

    // @notice redeem and burn the NFT tokens
    function redeem(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external whenNotPaused {
        // burn token
        _burnBatch(_msgSender(), tokenIds, amounts);
        DeMineNFTAdmin(payable(owner())).redeem(
            _msgSender(),
            tokenIds,
            amounts
        );
    }

    function setTokenRoyaltyBps(uint16 bps) external onlyOwner {
        _royaltyBps = bps;
        emit TokenRoyaltySet(bps);
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
