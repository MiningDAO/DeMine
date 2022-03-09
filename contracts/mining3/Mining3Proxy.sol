// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract Mining3Proxy is Proxy {
    event Clone(address indexed source, address indexed cloned);

    address public immutable beacon;

    constructor(address _beacon) {
        beacon = _beacon;
    }

    function clone(bytes memory data, address owner) external returns(address) {
        address cloned = Clones.clone(address(this));
        emit Clone(address(this), cloned);
        (bool success, bytes memory result) = cloned.call(data);
        require(success, string(result));
        OwnableUpgradeable(cloned).transferOwnership(owner);
        return cloned;
    }

    function _implementation() internal view override returns (address) {
        return IBeacon(beacon).implementation();
    }
}
