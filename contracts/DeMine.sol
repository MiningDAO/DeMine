// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';

import './utils/Initializable.sol';

contract DeMine is DiamondBase, SafeOwnable, ERC165 {
    using OwnableStorage for OwnableStorage.Layout;

    constructor(address initializer) {
        DiamondBaseStorage.layout().fallbackAddress = initializer;
        OwnableStorage.layout().setOwner(msg.sender);
    }

    receive() external payable {}
}
