// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/utils/AddressUtils.sol';
import './InitializableStorage.sol';

abstract contract Initializable {
    modifier initializer() {
        InitializableStorage.Layout storage l = InitializableStorage.layout();

        // If the contract is initializing we ignore whether _initialized is set in order to support multiple
        // inheritance patterns, but we only do this in the context of a constructor, because in other contexts the
        // contract may have been reentered.
        require(
            l.initializing ? _isConstructor() : !l.initialized,
            "Initializable: contract is already initialized"
        );

        bool isTopLevelCall = !l.initializing;
        if (isTopLevelCall) {
            l.initializing = true;
            l.initialized = true;
        }

        _;

        if (isTopLevelCall) {
            l.initializing = false;
        }
    }

    modifier onlyInitializing() {
        bool initializing = InitializableStorage.layout().initializing;
        require(initializing, "Initializable: contract is not initializing");
        _;
    }

    function _isConstructor() private view returns (bool) {
        return !AddressUtils.isContract(address(this));
    }
}
