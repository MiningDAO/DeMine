// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

contract WrappedTokenCloneFactory {
    address immutable implementation;

    constructor() {
        implementation = address(new WrappedToken());
    }

    function create(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) external returns(address) {
        address clone = ClonesUpgradeable.clone(implementation);
        WrappedToken(clone).initialize(name, symbol, decimals);
        return clone;
    }
}

contract WrappedToken is
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    uint8 private _decimals;

    function initialize(
        string memory name,
        string memory symbol,
        uint8 decimalsToSet
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __ERC20_init(name, symbol);
        _decimals = decimalsToSet;
    }

    constructor() initializer {}

    function burn(
        address _account,
        uint256 _amount
    ) external onlyOwner {
        _burn(_account, _amount);
    }

    function mint(
        address _to,
        uint256 _amount
    ) external onlyOwner {
        _mint(_to, _amount);
    }

    function decimals()
        public
        view
        override
        returns (uint8)
    {
        return _decimals;
    }
}
