// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./DeMineNFT.sol";

contract DeMineAgentCloneFactory {
    address immutable implementation;

    constructor() {
        implementation = address(new DeMineAgent());
    }

    function create(
        address nft,
        address costToken,
        address costRecipient,
        address owner
    ) external returns(address) {
        address cloned = Clones.clone(implementation);
        DeMineAgent(cloned).initialize(
            costToken,
            costRecipient
        );
        DeMineAgent(cloned).transferOwnership(owner);
        return cloned;
    }
}

/// @author Shu Dong
contract DeMineAgent is
    OwnableUpgradeable,
    IERC1155Receiver
{
    event PoolSet(uint128, address, uint256);
    event SellingSet(address, address, uint256[], uint256[], uint256[]);
    event SellingUnset(address, address, uint256[]);
    event Claim(address, uint256, uint256, uint256[], uint256[]);
    event Redeem(address, uint256, uint256[], uint256[]);
    event Withdraw(address, uint256);
    event NFTSet(address);

    address private _nft;
    address private _costToken;
    address private _costRecipient;

    struct Pool {
        address issuer;
        uint256 costPerToken;
    }
    mapping(uint128 => Pool) private _pools;
    mapping(uint256 => uint256) private _balances;
    struct SaleInfo {
        uint256 amount;
        uint256 price;
    }
    mapping(address => mapping(uint256 => SaleInfo)) private _selling;
    mapping(address => uint256) private _income;

    function initialize(
        address nft,
        address costToken,
        address costRecipient
    ) public initializer {
        __Ownable_init();
        _nft = nft;
        _costToken = costToken;
        _costRecipient = costRecipient;
    }

    function setNFT() external onlyOwner {
        require(
            _nft == address(0),
            "nft address already set"
        );
        require(
            DeMineNFT(nft).agent() == address(this),
            "unpaired nft"
        );
        _nft = nft;
        emit NFTSet(agent);
    }

    function setPool(
        uint128 pool,
        address issuer,
        uint256 costPerToken
    ) external {
        require(_msgSender() == _nft, "only nft contract allowed");
        _pools[pool].issuer = issuer;
        _pools[pool].costPerToken = costPerToken;
        emit PoolSet(pool, issuer, costPerToken);
    }

    function setSelling(
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        uint256[] calldata prices
    ) external {
        require(
            ids.length == amounts.length && amounts.length == prices.length,
            "array length mismatch"
        );
        address sender = _msgSender();
        require(sender != recipient, "cannot set issuer as recipient");
        for (uint256 i = 0; i < ids.length; i++) {
            uint128 pool = uint128(ids[i] >> 128);
            require(sender == _pools[pool].issuer, "only token issuer allowed");
            require(
                prices[i] >= _pools[pool].costPerToken,
                "price too low to cover cost"
            );
            uint256 balance = _balances[ids[i]];
            uint256 selling = _selling[recipient][ids[i]].amount;
            require(
                balance + selling >= amounts[i],
                "DeMineAgent: insufficient balance to sale"
            );
            _balances[ids[i]] = balance + selling - amounts[i];
            _selling[recipient][ids[i]].amount = amounts[i];
            _selling[recipient][ids[i]].price = prices[i];
        }
        emit SellingSet(sender, recipient, ids, amounts, prices);
    }

    function unsetSelling(
        address recipient,
        uint256[] calldata ids
    ) external {
        for (uint256 i = 0; i < ids.length; i++) {
            uint128 pool = uint128(ids[i] >> 128);
            require(
                _msgSender() == _pools[pool].issuer,
                "only token issuer allowed"
            );
            _balances[ids[i]] += _selling[recipient][ids[i]].amount;
            _selling[recipient][ids[i]].amount = 0;
        }
        emit SellingUnset(_msgSender(), recipient, ids);
    }

    function claim(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        require(
            ids.length == amounts.length,
            "array length mismatch"
        );
        address sender = _msgSender();
        uint256 totalCost;
        uint256 totalPrice;
        for (uint256 i = 0; i < ids.length; i++) {
            uint128 pool = uint128(ids[i] >> 128);
            uint256 cost = _pools[pool].costPerToken * amounts[i];
            uint256 price = claim(sender, ids[i], amounts[i]);
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

    function claim(
        address buyer,
        uint256 id,
        uint256 amount
    ) private returns(uint256) {
        uint256 allowance1 = _selling[buyer][id].amount;
        uint256 allowance2 = _selling[address(0)][id].amount;
        require(
            allowance1 + allowance2 >= amount,
            "DeMineAgent: insufficient locked to claim"
        );
        if (allowance1 >= amount) {
            _selling[buyer][id].amount = allowance1 - amount;
            return amount * _selling[buyer][id].price;
        } else {
            _selling[buyer][id].amount = 0;
            _selling[address(0)][id].amount = allowance1 + allowance2 - amount;
            return _selling[buyer][id].price * allowance1 +
                _selling[address(0)][id].price * (amount - allowance1);
        }
    }

    function redeem(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        require(
            ids.length == amounts.length,
            "array length mismatch"
        );
        uint256 totalCost;
        for (uint256 i = 0; i < ids.length; i++) {
            uint128 pool = uint128(ids[i] >> 128);
            require(
                _msgSender() == _pools[pool].issuer,
                "only token issuer allowed"
            );
            uint256 fromBalance = _balances[ids[i]];
            require(
                fromBalance >= amounts[i],
                "DeMineAdmin: insufficient balance to liquidize"
            );
            _balances[ids[i]] = fromBalance - amounts[i];
            totalCost += _pools[pool].costPerToken * amounts[i];
        }
        pay(_msgSender(), _costRecipient, totalCost);
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), _msgSender(), ids, amounts, ""
        );
        emit Redeem(
            _msgSender(),
            totalCost,
            ids,
            amounts
        );
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 amount,
        bytes calldata
    ) external override returns (bytes4) {
        require(
            operator == _nft && from == address(0),
            "only newly minted token allowed"
        );
        _balances[id] += amount;
        return bytes4(
            keccak256(
                "onERC1155Received(address,address,uint256,uint256,bytes)"
            )
        );
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata
    ) external override returns (bytes4) {
        require(
            operator == _nft && from == address(0),
            "only newly minted token allowed"
        );
        for (uint256 i = 0; i < ids.length; i++) {
            _balances[ids[i]] += amounts[i];
        }
        return bytes4(
            keccak256(
                "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"
            )
        );
    }

    function withdraw(uint256 amount) external {
        address sender = _msgSender();
        require(
            _income[sender] > amount,
            "insufficient balance to withdraw"
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
