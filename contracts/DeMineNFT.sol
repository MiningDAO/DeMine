// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./IDeMineNFTAdmin.sol";
import "./IDeMineNFT.sol";

/// @title DeMineNFT
/// @author Shu Dong
/// This smart contract enables DeMine DAO to issue new NFTs and manage value of them.
contract DeMineNFT is
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    IERC2981Upgradeable,
    IDeMineNFT
{
    // Events
    event LogEthDeposit(address);
    event TokenRoyaltySet(uint256);
    event Redeem(address, uint256, uint256);

    address private _royaltyRecipient;
    uint16 private _royaltyBps; // EIP2981

    function initialize(
        string memory uri,
        address royaltyRecipient,
        uint16 royaltyBps
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ERC1155_init(uri);
        _royaltyRecipient = royaltyRecipient;
        _royaltyBps = royaltyBps;
    }

    constructor() initializer {}

    // @notice start a new pool
    function mint(
        address recipient,
        uint256[] calldata tokenIds,
        uint256[] calldata supplies
    ) external override onlyOwner {
        _mintBatch(recipient, tokenIds, supplies, "");
    }

    function pause() external override onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() external override onlyOwner whenPaused {
        _unpause();
    }

    // @notice redeem and burn the NFT tokens
    function redeem(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external whenNotPaused {
        _burnBatch(_msgSender(), tokenIds, amounts);
        IDeMineNFTAdmin(payable(owner())).redeem(
            _msgSender(),
            tokenIds,
            amounts
        );
    }

    function setTokenRoyaltyInfo(
        address recipient,
        uint16 bps
    ) external onlyOwner {
        _royaltyRecipient = recipient;
        _royaltyBps = bps;
        emit TokenRoyaltySet(bps);
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
            interfaceId == type(IDeMineNFT).interfaceId ||
            interfaceId == type(IERC2981Upgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
