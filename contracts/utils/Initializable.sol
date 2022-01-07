// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/utils/AddressUtils.sol';
import './InitializableStorage.sol';

abstract contract Initializable {
    modifier initializer() {
        require(
            !InitializableStorage.layout().initialized,
            "Initializable: contract is already initialized"
        );
        _;
        InitializableStorage.layout().initialized = true;
    }

    function _isConstructor() private view returns (bool) {
        return !AddressUtils.isContract(address(this));
    }
}
