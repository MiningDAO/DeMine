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
    event PaymentSet(address indexed, bool);
    event CustodianSet(address indexed, address indexed);
    event PriceSet(address indexed, uint128 indexed, uint128[], uint256[]);

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
    event Claim(
        address indexed,
        address indexed,
        uint256[],
        uint256[],
        address,
        uint256
    );
    event Redeem(
        address indexed,
        uint256[],
        uint256[],
        address,
        uint256
    );

    address private _nft;
    address private _custodian;

    struct Pool {
        address owner;
        uint256 costPerToken;
    }
    mapping(uint128 => Pool) private _pools;

    struct TokenInfo {
        uint256 locked;
        uint256 price;
    }
    mapping(uint256 => TokenInfo) private _tokens;

    mapping(uint256 => mapping(address => uint256)) _allowance;
    mapping(address => bool) private _payments;

    modifier onlyNFT(address from) {
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

    function setPrice(
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata prices
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == prices.length,
            "DeMineAgent: array length mismatch"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            _tokens[id].price = prices[i];
        }
        emit PriceSet(_msgSender(), pool, cycles, prices);
    }

    function increaseAllowance(
        address to,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata allowances
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == allowances.length,
            "DeMineAgent: array length mismatch"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            _allowance[id][to] -= allowances[i];
        }
        emit IncreaseAllowance(_msgSender(), to, pool, cycles, allowances);
    }

    function decreaseAllowance(
        address to,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata allowances
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == allowances.length,
            "DeMineAgent: array length mismatch"
        );
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            uint256 allowance = _allowance[id][to];
            require(
                allowance > allowances[i],
                "DeMineAgent: decreased allowance below zero"
            );
            _allowance[id][to] = allowance - allowances[i];
        }
        emit DecreaseAllowance(_msgSender(), to, pool, cycles, allowances);
    }

    function redeem(
        address payment,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused onlyPoolOwner(pool) onlySupportedPayment(payment) {
        require(
            cycles.length == amounts.length,
            "DeMineAgent: array length mismatch"
        );
        uint256 costPerToken = _pools[pool].costPerToken;
        uint256 totalCost;
        uint256[] memory ids = new uint256[](cycles.length);
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            uint256 locked = _tokens[id].locked;
            require(
                locked >= amounts[i],
                "DeMineAgent: insufficient balance to redeem"
            );
            _tokens[id].locked = locked - amounts[i];
            totalCost += costPerToken * amounts[i];
            ids[i] = id;
        }
        IERC20(payment).safeTransferFrom(
            _msgSender(), _custodian, totalCost
        );
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), _msgSender(), ids, amounts, ""
        );
        emit Redeem(_msgSender(), ids, amounts, payment, totalCost);
    }

    function transferPool(
        uint128 pool,
        address newOwner
    ) external whenNotPaused onlyPoolOwner(pool) {
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
        uint256 costPerToken = _pools[pool].costPerToken;
        uint256 totalToPay;
        uint256 totalCost;
        uint256[] memory ids = new uint256[](cycles.length);
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            totalToPay += _claimOne(claimer, id, amounts[i]);
            totalCost += costPerToken * amounts[i];
            ids[i] = id;
        }
        DeMineNFT(_nft).safeBatchTransferFrom(
            address(this), _msgSender(), ids, amounts, ""
        );
        IERC20(payment).safeTransferFrom(
            _msgSender(), _custodian, totalCost
        );
        IERC20(payment).safeTransferFrom(
            _msgSender(),
            _pools[pool].owner,
            totalToPay - totalCost
        );
        emit Claim(_msgSender(), claimer, ids, amounts, payment, totalCost);
    }

    function _claimOne(
        address claimer,
        uint256 id,
        uint256 amount
    ) private returns(uint256) {
        uint256 locked = _tokens[id].locked;
        uint256 allowance = _allowance[id][claimer];
        require(
            locked >= amount && allowance >= amount,
            "DeMineAgent: insufficient inventory or allowance"
        );
        _allowance[id][claimer] = allowance - amount;
        _tokens[id].locked = locked - amount;
        return _tokens[id].price * amount;
    }

    function onERC1155Received(
        address,
        address from,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external onlyNFT(from) override returns (bytes4) {
        _setPool(data);
        _tokens[id].locked += amount;
        return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes memory data
    ) external onlyNFT(from) override returns (bytes4) {
        _setPool(data);
        for (uint256 i = 0; i < ids.length; i++) {
            _tokens[ids[i]].locked += amounts[i];
        }
        return IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector;
    }

    function _setPool(bytes memory data) private {
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

    function cashout(uint256[] calldata ids) external onlyOwner {
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            amounts[i] = _tokens[ids[i]].locked;
            _tokens[ids[i]].locked = 0;
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

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function isPaymentSupported(
        address payment
    ) public view returns(bool) {
        return _payments[payment];
    }

    function checkAllowance(
        address recipient,
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            amounts[i] = _allowance[id][recipient];
        }
        return amounts;
    }

    function checkPool(
        uint128 pool
    ) external view returns(address, uint256) {
        return (
            _pools[pool].owner,
            _pools[pool].costPerToken
        );
    }

    function checkToken(
        uint256 id
    ) external view returns(uint256, uint256) {
        return (_tokens[id].locked, _tokens[id].price);
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
