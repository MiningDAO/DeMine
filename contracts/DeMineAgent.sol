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

    event NewPool(uint128 indexed, address indexed, uint256, uint256);
    event PoolTransfer(uint128 indexed, address indexed, address indexed);
    event PaymentSet(address indexed, bool);
    event CustodianSet(address indexed, address indexed);
    event PricesSet(address indexed, uint128 indexed, uint128[], uint256[]);

    event IncreaseAllowance(
        address indexed,
        address indexed,
        uint128 indexed,
        uint128[],
        uint256[]
    );
    event DecreaseAllowance(
        address indexed,
        address indexed,
        uint128 indexed,
        uint128[],
        uint256[]
    );
    event Claim(address indexed, address indexed, uint128 indexed, address);
    event Redeem(address indexed, uint128 indexed, address);

    address private _nft;
    address private _custodian;

    struct Pool {
        address owner;
        uint256 tokenCost;
        uint256 tokenPrice;
    }
    mapping(uint128 => Pool) private _pools;
    mapping(uint256 => uint256) private _prices;
    mapping(uint256 => mapping(address => uint256)) _allowances;
    mapping(address => bool) private _payments;

    modifier onlyMint(address from) {
        require(
            _msgSender() == _nft,
            "DeMineAgent: only nft contract allowed"
        );
        require(
            from == address(0),
            "DeMineAgent: only newly minted token allowed"
        );
        _;
    }

    modifier onlyPoolOwner(uint128 pool) {
        require(
            _msgSender() == _pools[pool].owner,
            "DeMineAgent: only pool owner allowed"
        );
        _;
    }

    modifier onlySupportedPayment(address payment) {
        require(
            isPaymentSupported(payment),
            "DeMineAgent: payment not supported"
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

    function setPrices(
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata newPrices
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == newPrices.length,
            "DeMineAgent: array length mismatch"
        );
        uint256 tokenCost = _pools[pool].tokenCost;
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            require(
                newPrices[i] >= tokenCost,
                "DeMineAgent: price too low to cover cost"
            );
            _prices[id] = newPrices[i];
        }
        emit PricesSet(_msgSender(), pool, cycles, newPrices);
    }

    function increaseAllowance(
        address to,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata increment
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == increment.length,
            "DeMineAgent: array length mismatch"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            _allowances[id][to] += increment[i];
        }
        emit IncreaseAllowance(_msgSender(), to, pool, cycles, increment);
    }

    function decreaseAllowance(
        address to,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata decrement
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == decrement.length,
            "DeMineAgent: array length mismatch"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            uint256 allowance = _allowances[id][to];
            require(
                allowance >= decrement[i],
                "DeMineAgent: decreased allowance below zero"
            );
            _allowances[id][to] = allowance - decrement[i];
        }
        emit DecreaseAllowance(_msgSender(), to, pool, cycles, decrement);
    }

    function redeem(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    )
        external
        whenNotPaused
        onlyPoolOwner(pool)
        onlySupportedPayment(payment)
    {
        require(
            cycles.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        uint256 tokenCost = _pools[pool].tokenCost;
        uint256 totalCost;
        uint256[] memory ids = new uint256[](cycles.length);
        for (uint256 i = 0; i < cycles.length; i++) {
            ids[i] = (uint256(pool) << 128) + cycles[i];
            totalCost += tokenCost * amounts[i];
        }
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), _msgSender(), ids, amounts, ""
        );
        IERC20(payment).safeTransferFrom(
            _msgSender(), _custodian, totalCost
        );
        emit Redeem(_msgSender(), pool, payment);
    }

    function transferPool(
        uint128 pool,
        address newOwner
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            newOwner != address(0),
            "DeMineAgent: new pool owner is zero address"
        );
        _pools[pool].owner = newOwner;
        emit PoolTransfer(pool, _msgSender(), newOwner);
    }

    function claimUnnamed(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused onlySupportedPayment(payment) {
        _claim(address(0), payment, pool, cycles, amounts);
    }

    function claim(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused onlySupportedPayment(payment) {
        _claim(_msgSender(), payment, pool, cycles, amounts);
    }

    function _claim(
        address claimer,
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) private {
        require(
            cycles.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        uint256 basePrice = _pools[pool].tokenPrice;
        uint256 totalToPay;
        uint256[] memory ids = new uint256[](cycles.length);
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            uint256 allowance = _allowances[id][claimer];
            require(
                allowance >= amounts[i],
                "DeMineAgent: insufficient allowance"
            );
            _allowances[id][claimer] = allowance - amounts[i];
            uint256 price = _prices[id];
            totalToPay += (price > 0 ? price : basePrice) * amounts[i];
            ids[i] = id;
        }
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), _msgSender(), ids, amounts, ""
        );
        IERC20(payment).safeTransferFrom(
            _msgSender(), _custodian, totalToPay
        );
        emit Claim(_msgSender(), claimer, pool, payment);
    }

    function onERC1155Received(
        address,
        address from,
        uint256,
        uint256,
        bytes memory data
    ) external onlyMint(from) override returns (bytes4) {
        _setPool(data);
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata,
        uint256[] calldata,
        bytes memory data
    ) external onlyMint(from) override returns (bytes4) {
        _setPool(data);
        return IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector;
    }

    function _setPool(bytes memory data) private {
        (
            uint128 newPool,
            address owner,
            uint256 tokenCost,
            uint256 tokenPrice
        ) = abi.decode(data, (uint128, address, uint256, uint256));
        if (newPool > 0) {
            _pools[newPool].owner = owner;
            _pools[newPool].tokenCost = tokenCost;
            _pools[newPool].tokenPrice = tokenPrice;
            emit NewPool(newPool, owner, tokenCost, tokenPrice);
        }
    }

    function cashout(
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        DeMineNFT(_nft).cashout(
            address(this),
            _custodian,
            ids,
            amounts
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setCustodian(address newCustodian) external onlyOwner {
        emit CustodianSet(_custodian, newCustodian);
        _custodian = newCustodian;
    }

    function setPayment(address payment, bool supported) external onlyOwner {
        _payments[payment] = supported;
        emit PaymentSet(payment, supported);
    }

    function isPaymentSupported(
        address payment
    ) public view returns(bool) {
        return _payments[payment];
    }

    function allowances(
        address recipient,
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory result = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = _allowances[ids[i]][recipient];
        }
        return result;
    }

    function prices(
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory result = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = _prices[ids[i]];
        }
        return result;
    }

    function poolInfo(
        uint128 pool
    ) external view returns(address, uint256, uint256) {
        return (
            _pools[pool].owner,
            _pools[pool].tokenCost,
            _pools[pool].tokenPrice
        );
    }

    function supportsInterface(bytes4 interfaceId)
        public
        pure
        override
        returns (bool)
    {
        return interfaceId == type(IERC1155ReceiverUpgradeable).interfaceId;
    }
}
