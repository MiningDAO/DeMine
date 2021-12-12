// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

contract WrappedToken is
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    uint8 private _decimals;

    function initialize(
        string memory name,
        string memory symbol,
        uint8 decimalsToSet
    ) public initializer {
        __Ownable_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ERC20_init(name, symbol);
        _decimals = decimalsToSet;
    }

    constructor() initializer {}

    function _authorizeUpgrade(address) internal override onlyOwner {}

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

contract DWBTC is BeaconProxy {
    constructor(address beacon)
        BeaconProxy(
          beacon,
          abi.encodeWithSignature(
              "initialize(string memory, string memory, uint8)",
              "DeMine Wrapped BTC",
              "DWBTC",
              8
          )
        )
    {}
}

contract DWUSD is BeaconProxy {
    constructor(address beacon)
        BeaconProxy(
          beacon,
          abi.encodeWithSignature(
              "initialize(string memory, string memory, uint8)",
              "DeMine Wrapped USD",
              "USDD",
              6
          )
        )
    {}
}
