// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "./DeMineNFT.sol";

/// @author Shu Dong
contract DeMineAgent is
    OwnableUpgradeable,
    PausableUpgradeable,
    IERC1155ReceiverUpgradeable
{
    using SafeERC20 for IERC20;

    event PoolSet(uint128 indexed, address indexed, uint256);
    event PoolTransfer(uint128 indexed, address indexed, address indexed);
    event List(address indexed, address indexed, uint256[], uint256[], uint256[]);
    event Unlist(address indexed, address indexed, uint256[]);
    event Claim(address indexed, uint256, uint256, uint256[], uint256[]);
    event Redeem(address indexed, uint256, uint256[], uint256[]);
    event Withdraw(address indexed, address[], uint256[]);
    event PaymentSet(address indexed, bool);
    event CustodianSet(address indexed, address indexed);

    address private _nft;
    address private _custodian;

    struct Pool {
        address owner;
        uint256 costPerToken;
    }
    mapping(uint128 => Pool) private _pools;
    struct ListingInfo {
        uint256 amount;
        uint256 price;
    }
    struct TokenInfo {
        bool cashedout;
        uint256 liquidized;
        uint256 locked;
        uint256 listed;
        mapping(address => ListingInfo) listing;
    }
    mapping(uint256 => TokenInfo) private _stats;
    mapping(address => bool) private _payments;
    mapping(address => mapping(address => uint256)) private _income;

    modifier onlyNFT {
        require(
            _nft == _msgSender(),
            "DeMineAgent: only nft contract allowed"
        );
        _;
    }

    function initialize(
        address[] memory payments,
        address custodian,
        address nftContract
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        for (uint256 i = 0; i < payments.length; i++) {
            _payments[payments[i]] = true;
        }
        _custodian = custodian;
        _nft = nftContract;
    }

    constructor() initializer {}

    function list(
        address to,
        uint256[] calldata ids,
        uint256[] calldata prices,
        uint256[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == prices.length && prices.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        address sender = _msgSender();
        require(
            sender != to,
            "DeMineAgent: cannot set owner as recipient"
        );
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            require(
                !_stats[id].cashedout,
                "DeMineAgent: already cashed out"
            );
            uint128 pool = uint128(id >> 128);
            require(
                sender == _pools[pool].owner,
                "DeMineAgent: only token owner allowed"
            );
            require(
                prices[i] >= _pools[pool].costPerToken,
                "DeMineAgent: price too low to cover cost"
            );
            uint256 selling = _stats[id].listing[to].amount;
            uint256 locked = _stats[id].locked;
            require(
                locked + selling >= amounts[i],
                "DeMineAgent: insufficient balance to sale"
            );
            _stats[id].locked = locked + selling - amounts[i];
            _stats[id].listed = _stats[id].listed - selling + amounts[i];
            _stats[id].listing[to].amount = amounts[i];
            _stats[id].listing[to].price = prices[i];
        }
        emit List(sender, to, ids, amounts, prices);
    }

    function unlist(
        address to,
        uint256[] calldata ids
    ) external whenNotPaused {
        address sender = _msgSender();
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            require(
                sender == _pools[uint128(id >> 128)].owner,
                "DeMineAgent: only token owner allowed"
            );
            require(
                !_stats[id].cashedout,
                "DeMineAgent: already cashed out"
            );
            uint256 amount = _stats[id].listing[to].amount;
            _stats[id].locked += amount;
            _stats[id].listed -= amount;
            _stats[id].listing[to].amount = 0;
        }
        emit Unlist(sender, to, ids);
    }

    function claim(
        address payment,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        require(
            isPaymentSupported(payment),
            "DeMineAgent: payment method not supported"
        );
        address sender = _msgSender();
        uint256 totalCost;
        uint256 totalPrice;
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            require(
                !_stats[id].cashedout,
                "DeMineAgent: already cashed out"
            );
            (uint256 price, uint256 cost) = claimOne(sender, id, amounts[i]);
            totalCost += cost;
            totalPrice += price;
            address owner = _pools[uint128(id >> 128)].owner;
            _income[owner][payment] += (price - cost);
        }
        IERC20(payment).safeTransferFrom(sender, _custodian, totalCost);
        IERC20(payment).safeTransferFrom(
            sender,
            address(this),
            totalPrice - totalCost
        );
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), sender, ids, amounts, ""
        );
        emit Claim(sender, totalCost, totalPrice, ids, amounts);
    }

    function claimOne(
        address sender,
        uint256 id,
        uint256 amount
    ) private returns(uint256, uint256) {
        uint256 v1 = _stats[id].listing[sender].amount;
        uint256 v2 = _stats[id].listing[address(0)].amount;
        require(
            v1 + v2 >= amount,
            "DeMineAgent: insufficient allowance"
        );
        uint256 senderPrice = _stats[id].listing[sender].price;
        uint256 basePrice = _stats[id].listing[address(0)].price;
        uint256 price;
        if (v1 >= amount) {
            _stats[id].listing[sender].amount = v1 - amount;
            price = amount * senderPrice;
        } else {
            _stats[id].listing[sender].amount = 0;
            _stats[id].listing[address(0)].amount = v1 + v2 - amount;
            price = basePrice * (amount - v1) + senderPrice * v1;
        }
        _stats[id].listed -= amount;
        _stats[id].liquidized += amount;
        return (price, _pools[uint128(id >> 128)].costPerToken * amount);
    }

    function redeem(
        address payment,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        require(
            isPaymentSupported(payment),
            "DeMineAgent: payment method not supported"
        );
        uint256 totalCost;
        address sender = _msgSender();
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            uint128 pool = uint128(id >> 128);
            require(
                sender == _pools[pool].owner,
                "DeMineAgent: only token owner allowed"
            );
            uint256 locked = _stats[id].locked;
            require(
                locked >= amounts[i],
                "DeMineAgent: insufficient balance to liquidize"
            );
            _stats[id].locked = locked - amounts[i];
            _stats[id].liquidized += amounts[i];
            totalCost += _pools[pool].costPerToken * amounts[i];
        }
        IERC20(payment).safeTransferFrom(sender, _custodian, totalCost);
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), sender, ids, amounts, ""
        );
        emit Redeem(sender, totalCost, ids, amounts);
    }

    function transferPool(
        uint128 pool,
        address newOwner
    ) external whenNotPaused {
        require (
            _msgSender() == _pools[pool].owner,
            "DeMineAgent: only pool owner is allowed"
        );
        _pools[pool].owner = newOwner;
        emit PoolTransfer(pool, _msgSender(), newOwner);
    }

    function poolInfo(
        uint128 pool
    ) external view returns(address, uint256) {
        return (
            _pools[pool].owner,
            _pools[pool].costPerToken
        );
    }

    function onERC1155Received(
        address,
        address from,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external onlyNFT override returns (bytes4) {
        require(
            from == address(0),
            "DeMineAgent: only newly minted token allowed"
        );
        setPool(data);
        _stats[id].locked += amount;
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes memory data
    ) external onlyNFT override returns (bytes4) {
        require(
            from == address(0),
            "DeMineAgent: only newly minted token allowed"
        );
        setPool(data);
        for (uint256 i = 0; i < ids.length; i++) {
            _stats[ids[i]].locked += amounts[i];
        }
        return IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector;
    }

    function setPool(bytes memory data) private {
        (
            uint128 pool,
            address owner,
            uint256 costPerToken
        ) = abi.decode(data, (uint128, address, uint256));
        _pools[pool].owner = owner;
        _pools[pool].costPerToken = costPerToken;
        emit PoolSet(pool, owner, costPerToken);
    }

    function setPayment(address payment, bool supported) external onlyOwner {
        _payments[payment] = supported;
        emit PaymentSet(payment, supported);
    }

    function isPaymentSupported(address payment) public view returns(bool) {
        return _payments[payment];
    }

    function cashout(uint256[] calldata ids) external onlyOwner {
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            require(
                !_stats[id].cashedout,
                "DeMineAgent: already cashed out"
            );
            _stats[id].cashedout = true;
            amounts[i] = _stats[id].locked + _stats[id].listed;
            _stats[id].liquidized += amounts[i];
            _stats[id].listed = 0;
            _stats[id].locked = 0;
        }
        DeMineNFT(_nft).cashout(
            address(this),
            _custodian,
            ids,
            amounts
        );
    }

    function setCustodian(address newCustodian) external onlyOwner {
        emit CustodianSet(_custodian, newCustodian);
        _custodian = newCustodian;
    }

    function withdraw(
        address[] calldata payments,
        uint256[] calldata amounts
    ) external whenNotPaused {
        address sender = _msgSender();
        require(
            payments.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        for (uint256 i = 0; i < amounts.length; i++) {
            address payment = payments[i];
            require(
                _income[sender][payment] >= amounts[i],
                "DeMineAgent: insufficient balance"
            );
            IERC20(payment).safeTransfer(sender, amounts[i]);
            _income[sender][payment] -= amounts[i];
        }
        emit Withdraw(sender, payments, amounts);
    }

    function listingInfo(
        address recipient,
        uint256[] calldata ids
    ) external view returns(
        uint256[] memory, uint256[] memory
    ) {
        uint256[] memory prices = new uint256[](ids.length);
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            prices[i] = _stats[id].listing[recipient].price;
            amounts[i] = _stats[id].listing[recipient].amount;
        }
        return (prices, amounts);
    }

    function tokenInfo(
        uint256 id
    ) external view returns(bool, uint256, uint256, uint256) {
        return (
            _stats[id].cashedout,
            _stats[id].liquidized,
            _stats[id].locked,
            _stats[id].listed
        );
    }

    function incomeInfo(
        address who,
        address[] calldata payments
    ) external view returns(uint256[] memory) {
        uint256[] memory amounts = new uint256[](payments.length);
        for (uint256 i = 0; i < payments.length; i++) {
            amounts[i] = _income[who][payments[i]];
        }
        return amounts;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        pure
        override
        returns (bool)
    {
        return interfaceId == type(IERC1155ReceiverUpgradeable).interfaceId;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
