// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./DeMineNFT.sol";

/// @author Shu Dong
contract DeMineAgent is
    OwnableUpgradeable,
    IERC1155Receiver
{
    event PoolTransfer(uint128 indexed, address indexed, address indexed);
    event List(address indexed, address indexed, uint256[], uint256[], uint256[]);
    event Unlist(address indexed, address indexed, uint256[]);
    event Claim(address indexed, uint256, uint256, uint256[], uint256[]);
    event Redeem(address indexed, uint256, uint256[], uint256[]);
    event Withdraw(address indexed, uint256);

    address private _nft;
    address private _costToken;
    address private _costRecipient;

    struct Pool {
        address issuer;
        uint256 costPerToken;
    }
    mapping(uint128 => Pool) private _pools;
    mapping(uint256 => uint256) private _inventory;
    struct ListingInfo {
        uint256 amount;
        uint256 price;
    }
    struct Listing {
        bool cashedout;
        uint256 total;
        mapping(address => ListingInfo) info;
    }
    mapping(uint256 => Listing) private _listing;
    mapping(address => uint256) private _income;

    modifier onlyNFT {
        require(
            _nft == _msgSender(),
            "DeMineAgent: only nft contract allowed"
        );
        _;
    }

    function initialize(
        address costToken,
        address costRecipient,
        address nftAddr
    ) public initializer {
        __Ownable_init();
        _costToken = costToken;
        _costRecipient = costRecipient;
        _nft = nftAddr;
    }

    constructor() initializer {}

    function list(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        uint256[] calldata prices
    ) external {
        require(
            ids.length == amounts.length && amounts.length == prices.length,
            "DeMineAgent: array length mismatch"
        );
        address sender = _msgSender();
        require(
            sender != to,
            "DeMineAgent: cannot set issuer as recipient"
        );
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            require(
                !_listing[id].cashedout,
                "DeMineAgent: already cashed out"
            );
            uint128 pool = uint128(id >> 128);
            require(
                sender == _pools[pool].issuer,
                "DeMineAgent: only token issuer allowed"
            );
            require(
                prices[i] >= _pools[pool].costPerToken,
                "DeMineAgent: price too low to cover cost"
            );
            uint256 selling = _listing[id].info[to].amount;
            require(
                _inventory[id] + selling >= amounts[i],
                "DeMineAgent: insufficient balance to sale"
            );
            _inventory[id] = _inventory[id] + selling - amounts[i];
            _listing[id].total = _listing[id].total - selling + amounts[i];
            _listing[id].info[to].amount = amounts[i];
            _listing[id].info[to].price = prices[i];
        }
        emit List(sender, to, ids, amounts, prices);
    }

    function unlist(
        address to,
        uint256[] calldata ids
    ) external {
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            require(
                !_listing[id].cashedout,
                "DeMineAgent: already cashed out"
            );
            require(
                _msgSender() == _pools[uint128(id >> 128)].issuer,
                "DeMineAgent: only token issuer allowed"
            );
            uint256 amount = _listing[id].info[to].amount;
            _inventory[id] += amount;
            _listing[id].total -= amount;
            _listing[id].info[to].amount = 0;
        }
        emit Unlist(_msgSender(), to, ids);
    }

    function claim(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        require(
            ids.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        address sender = _msgSender();
        uint256 totalCost;
        uint256 totalPrice;
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            require(
                !_listing[id].cashedout,
                "DeMineAgent: already cashed out"
            );
            uint256 v1 = _listing[id].info[sender].amount;
            uint256 v2 = _listing[id].info[address(0)].amount;
            require(
                v1 + v2 >= amounts[i],
                "DeMineAgent: insufficient allowance"
            );
            uint256 senderPrice = _listing[id].info[sender].price;
            uint256 basePrice = _listing[id].info[address(0)].price;
            uint256 price;
            if (v1 >= amounts[i]) {
                _listing[id].info[sender].amount = v1 - amounts[i];
                price = amounts[i] * senderPrice;
            } else {
                _listing[id].info[sender].amount = 0;
                _listing[id].info[address(0)].amount = v1 + v2 - amounts[i];
                price = basePrice * (amounts[i] - v1) + senderPrice * v1;
            }
            _listing[id].total -= amounts[i];
            uint128 pool = uint128(id >> 128);
            uint256 cost = _pools[pool].costPerToken * amounts[i];
            totalCost += cost;
            totalPrice += price;
            _income[_pools[pool].issuer] += (price - cost);
        }
        pay(sender, _costRecipient, totalCost);
        pay(sender, address(this), totalPrice - totalCost);
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), sender, ids, amounts, ""
        );
        emit Claim(sender, totalCost, totalPrice, ids, amounts);
    }

    function redeem(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        require(
            ids.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        uint256 totalCost;
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            uint128 pool = uint128(id >> 128);
            require(
                _msgSender() == _pools[pool].issuer,
                "DeMineAgent: only token issuer allowed"
            );
            require(
                _inventory[id] >= amounts[i],
                "DeMineAdmin: insufficient balance to liquidize"
            );
            _inventory[id] = _inventory[id] - amounts[i];
            totalCost += _pools[pool].costPerToken * amounts[i];
        }
        pay(_msgSender(), _costRecipient, totalCost);
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), _msgSender(), ids, amounts, ""
        );
        emit Redeem(_msgSender(), totalCost, ids, amounts);
    }

    function transferPool(
        uint128 pool,
        address newIssuer
    ) external {
        require (
            _msgSender() == _pools[pool].issuer,
            "DeMineAgent: only issuer is allowed"
        );
        _pools[pool].issuer = newIssuer;
        emit PoolTransfer(pool, _msgSender(), newIssuer);
    }

    function setPool(
        uint128 pool,
        address issuer,
        uint256 costPerToken
    ) external onlyNFT {
        _pools[pool].issuer = issuer;
        _pools[pool].costPerToken = costPerToken;
    }

    function onERC1155Received(
        address,
        address from,
        uint256 id,
        uint256 amount,
        bytes calldata
    ) external onlyNFT override returns (bytes4) {
        require(
            from == address(0),
            "only newly minted token allowed"
        );
        _inventory[id] += amount;
        return bytes4(
            keccak256(
                "onERC1155Received(address,address,uint256,uint256,bytes)"
            )
        );
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata
    ) external onlyNFT override returns (bytes4) {
        require(
            from == address(0),
            "only newly minted token allowed"
        );
        for (uint256 i = 0; i < ids.length; i++) {
            _inventory[ids[i]] += amounts[i];
        }
        return bytes4(
            keccak256(
                "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"
            )
        );
    }

    function cashout(uint256[] calldata ids) external onlyOwner {
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            _listing[id].cashedout = true;
            amounts[i] = _inventory[id] + _listing[id].total;
            _listing[id].total = 0;
            _inventory[id] = 0;
        }
        DeMineNFT(_nft).cashout(address(this), owner(), ids, amounts);
    }

    function withdraw(uint256 amount) external {
        address sender = _msgSender();
        require(
            _income[sender] > amount,
            "DeMineAgent: insufficient balance"
        );
        pay(address(this), sender, amount);
        _income[sender] -= amount;
        emit Withdraw(sender, amount);
    }

    function income() external view returns(uint256) {
        return _income[_msgSender()];
    }

    function nft() external view returns(address) {
        return _nft;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        pure
        override
        returns (bool)
    {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }

    function pay(
        address payer,
        address payee,
        uint256 value
    ) private {
        if (value > 0) {
            bool success = IERC20(_costToken).transferFrom(
                payer, payee, value
            );
            require(success, "failed to pay cost");
        }
    }
}
