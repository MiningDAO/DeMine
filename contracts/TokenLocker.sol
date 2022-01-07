// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';

import './utils/PausableInternal.sol';
import './controller/RewarderInternal.sol';
import './PoolInternal.sol';
import './TokenLockerStorage.sol';

contract TokenLocker is
    PoolInternal,
    PausableInternal,
    OwnableInternal,
    RewarderInternal,
    IERC1155Receiver
{
    using TokenLockerStorage for TokenLockerStorage.Layout;

    event NewPool(uint128 indexed, address, uint256, uint256);
    event TransferPool(uint128 indexed, address, address);
    event SetPoolPrice(uint128 indexed, uint256);

    event SetTokenPrices(
        address indexed,
        uint128 indexed,
        uint128[],
        uint256[]
    );
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

    modifier onlyMinted(address operator, address from) {
        require(
            operator == address(this) && from == address(0),
            "TokenLocker: only minted token allowed"
        );
        _;
    }

    function newPool(
        address owner,
        uint256 tokenCost,
        uint256 basePrice
    ) external onlyOwner {
        require(
            owner != address(0),
            "Pool: pool owner is zero address"
        );
        require(
            basePrice >= tokenCost,
            "Pool: token price lower than cost"
        );
        uint128 pool = TokenLockerStorage.layout().newPool(
            owner, tokenCost, basePrice
        );
        emit NewPool(pool, owner, tokenCost, basePrice);
    }

    function transferPool(
        uint128 pool,
        address newOwner
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            newOwner != address(0),
            "Pool: new pool owner is zero address"
        );
        TokenLockerStorage.layout().pools[pool].owner = newOwner;
        emit TransferPool(pool, _msgSender(), newOwner);
    }

    function setPoolPrice(
        uint128 pool,
        uint256 newPrice
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            newPrice >= TokenLockerStorage.layout().pools[pool].cost,
            "Pool: token price is lower than token cost"
        );
        TokenLockerStorage.layout().pools[pool].price = newPrice;
        emit SetPoolPrice(pool, newPrice);
    }

    function setTokenPrices(
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata newPrices
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == newPrices.length,
            "TokenLocker: array length mismatch"
        );
        uint256 tokenCost = TokenLockerStorage.layout().pools[pool].cost;
        mapping(uint256 => uint256)
            storage prices = TokenLockerStorage.layout().prices;
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            require(
                newPrices[i] >= tokenCost,
                "TokenLocker: price too low to cover cost"
            );
            prices[id] = newPrices[i];
        }
        emit SetTokenPrices(_msgSender(), pool, cycles, newPrices);
    }

    function increaseAllowance(
        address to,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata increment
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == increment.length,
            "TokenLocker: array length mismatch"
        );
        mapping(uint256 => mapping(address => uint256))
            storage allowances = TokenLockerStorage.layout().allowances;
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            allowances[id][to] += increment[i];
        }
        emit IncreaseAllowance(_msgSender(), to, pool, cycles, increment);
    }

    function decreaseAllowance(
        address to,
        uint128 pool,
        uint128[] calldata cycles,
        uint256[] calldata amounts
    ) external whenNotPaused onlyPoolOwner(pool) {
        require(
            cycles.length == amounts.length,
            "TokenLocker: array length mismatch"
        );
        TokenLockerStorage.Layout storage l = TokenLockerStorage.layout();
        for (uint256 i = 0; i < cycles.length; i++) {
            uint256 id = (uint256(pool) << 128) + cycles[i];
            l.decreaseAllowance(id, to, amounts[i]);
        }
        emit DecreaseAllowance(_msgSender(), to, pool, cycles, amounts);
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256,
        uint256,
        bytes memory
    )
        external
        view
        whenNotPaused
        onlyMinted(operator, from)
        override
        returns(bytes4)
    {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata,
        uint256[] calldata,
        bytes memory
    )
        external
        view
        whenNotPaused
        onlyMinted(operator, from)
        override
        returns(bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function getAllowances(
        address recipient,
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory result = new uint256[](ids.length);
        mapping(uint256 => mapping(address => uint256))
            storage allowances = TokenLockerStorage.layout().allowances;
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = allowances[ids[i]][recipient];
        }
        return result;
    }

    function getPrices(
        uint256[] calldata ids
    ) external view returns(uint256[] memory) {
        uint256[] memory result = new uint256[](ids.length);
        mapping(uint256 => uint256)
            storage prices = TokenLockerStorage.layout().prices;
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            uint128 pool = uint128(id >> 128);
            uint256 basePrice = TokenLockerStorage.layout().pools[pool].price;
            result[i] = prices[id] > 0 ? prices[id] : basePrice;
        }
        return result;
    }

    function poolInfo(
        uint128 pool
    ) external view returns(address, uint256, uint256) {
        TokenLockerStorage.Pool
            memory p = TokenLockerStorage.layout().pools[pool];
        return (p.owner, p.cost, p.price);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
