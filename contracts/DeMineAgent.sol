// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./DeMineNFT.sol";

/// @author Shu Dong
contract DeMineAgent is
    OwnableUpgradeable,
    IERC1155Receiver
{
    using SafeERC20 for IERC20;

    event PoolTransfer(uint128 indexed, address indexed, address indexed);
    event List(address indexed, address indexed, uint256[], uint256[], uint256[]);
    event Unlist(address indexed, address indexed, uint256[]);
    event Claim(address indexed, uint256, uint256, uint256[], uint256[]);
    event Redeem(address indexed, uint256, uint256[], uint256[]);
    event Withdraw(address indexed, address[], uint256[]);
    event PaymentSet(address indexed, address indexed, address indexed);
    event RewardRecipientSet(address indexed, address indexed);

    address private _nft;
    address private _rewardRecipient;

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
    mapping(address => address) private _payments;
    mapping(address => mapping(address => uint256)) private _income;

    modifier onlyNFT {
        require(
            _nft == _msgSender(),
            "DeMineAgent: only nft contract allowed"
        );
        _;
    }

    function initialize(
        address[] memory paymentMethods,
        address[] memory paymentRecipients,
        address rewardRecipient,
        address nftContract
    ) public initializer {
        __Ownable_init();
        require(
            paymentMethods.length == paymentRecipients.length,
            "DeMineAgent: payment array length mismatch"
        );
        for (uint256 i = 0; i < paymentMethods.length; i++) {
            _payments[paymentMethods[i]] = paymentRecipients[i];
        }
        _rewardRecipient = rewardRecipient;
        _nft = nftContract;
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
    ) external {
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            require(
                _msgSender() == _pools[uint128(id >> 128)].owner,
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
        emit Unlist(_msgSender(), to, ids);
    }

    function claim(
        uint256[] calldata ids,
        uint256[] calldata amounts,
        address payment
    ) external {
        require(
            ids.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        require(
            _payments[payment] != address(0),
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
            uint256 v1 = _stats[id].listing[sender].amount;
            uint256 v2 = _stats[id].listing[address(0)].amount;
            require(
                v1 + v2 >= amounts[i],
                "DeMineAgent: insufficient allowance"
            );
            uint256 senderPrice = _stats[id].listing[sender].price;
            uint256 basePrice = _stats[id].listing[address(0)].price;
            uint256 price;
            if (v1 >= amounts[i]) {
                _stats[id].listing[sender].amount = v1 - amounts[i];
                price = amounts[i] * senderPrice;
            } else {
                _stats[id].listing[sender].amount = 0;
                _stats[id].listing[address(0)].amount = v1 + v2 - amounts[i];
                price = basePrice * (amounts[i] - v1) + senderPrice * v1;
            }
            _stats[id].listed -= amounts[i];
            _stats[id].liquidized += amounts[i];
            uint128 pool = uint128(id >> 128);
            uint256 cost = _pools[pool].costPerToken * amounts[i];
            totalCost += cost;
            totalPrice += price;
            _income[_pools[pool].owner][payment] += (price - cost);
        }
        IERC20(payment).safeTransferFrom(
            sender,
            _payments[payment],
            totalCost
        );
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

    function redeem(
        uint256[] calldata ids,
        uint256[] calldata amounts,
        address payment
    ) external {
        require(
            ids.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        require(
            _payments[payment] != address(0),
            "DeMineAgent: payment method not supported"
        );
        uint256 totalCost;
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            uint128 pool = uint128(id >> 128);
            require(
                _msgSender() == _pools[pool].owner,
                "DeMineAgent: only token owner allowed"
            );
            uint256 locked = _stats[id].locked;
            require(
                locked >= amounts[i],
                "DeMineAdmin: insufficient balance to liquidize"
            );
            _stats[id].locked = locked - amounts[i];
            _stats[id].liquidized += amounts[i];
            totalCost += _pools[pool].costPerToken * amounts[i];
        }
        IERC20(payment).safeTransferFrom(
            _msgSender(),
            _payments[payment],
            totalCost
        );
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), _msgSender(), ids, amounts, ""
        );
        emit Redeem(_msgSender(), totalCost, ids, amounts);
    }

    function transferPool(
        uint128 pool,
        address newOwner
    ) external {
        require (
            _msgSender() == _pools[pool].owner,
            "DeMineAgent: only pool owner is allowed"
        );
        _pools[pool].owner = newOwner;
        emit PoolTransfer(pool, _msgSender(), newOwner);
    }

    function setPool(
        uint128 pool,
        address owner,
        uint256 costPerToken
    ) external onlyNFT {
        _pools[pool].owner = owner;
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
        _stats[id].locked += amount;
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
            _stats[ids[i]].locked += amounts[i];
        }
        return bytes4(
            keccak256(
                "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"
            )
        );
    }

    function setRewardRecipient(
        address newRewardRecipient
    ) external onlyOwner {
        emit RewardRecipientSet(_rewardRecipient, newRewardRecipient);
        _rewardRecipient = newRewardRecipient;
    }

    function setPayment(
        address payment,
        address newRecipient
    ) external onlyOwner {
        emit PaymentSet(
            payment,
            _payments[payment],
            newRecipient
        );
        _payments[payment] = newRecipient;
    }

    function paymentInfo(
        address payment
    ) external view returns(address) {
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
            _rewardRecipient,
            ids,
            amounts
        );
    }

    function withdraw(
        address[] calldata payments,
        uint256[] calldata amounts
    ) external {
        address sender = _msgSender();
        require(
            payments.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        for (uint256 i = 0; i < amounts.length; i++) {
            address payment = payments[i];
            require(
                _income[sender][payment] > amounts[i],
                "DeMineAgent: insufficient balance"
            );
            IERC20(payment).safeTransfer(sender, amounts[i]);
            _income[sender][payment] -= amounts[i];
        }
        emit Withdraw(sender, payments, amounts);
    }

    function isPaymentSupported(
        address payment
    ) external view returns(bool) {
        return _payments[payment] != address(0);
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
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
