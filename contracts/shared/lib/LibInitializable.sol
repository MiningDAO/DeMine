// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import '@solidstate/contracts/utils/AddressUtils.sol';

/**
 * @dev derived from https://github.com/OpenZeppelin/openzeppelin-contracts (MIT license)
 */
library InitializableStorage {
    struct Layout {
        bool initialized;
        bool initializing;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('demine.contracts.storage.Initializable');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract Initializable {
    modifier initializer() {
        InitializableStorage.Layout storage l = InitializableStorage.layout();
        require(
            l.initializing ? isConstructor() : !l.initialized,
            'Initializable: contract is already initialized'
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
        require(
            InitializableStorage.layout().initializing,
            'Initializable: contract is not initializing'
        );
        _;
    }

    function isConstructor() private view returns (bool) {
        return !AddressUtils.isContract(address(this));
    }
}
