// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '../interfaces/IPausable.sol';

library LibPausable {
    struct Layout {
        bool paused;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('solidstate.contracts.storage.Pausable');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract PausableModifier {
    modifier whenPaused() {
        require(LibPausable.layout().paused, 'Pausable: not paused');
        _;
    }

    modifier whenNotPaused() {
        require(!LibPausable.layout().paused, 'Pausable: paused');
        _;
    }
}

abstract contract Pausable is IPausable, OwnableInternal {
    function paused() external override view returns (bool) {
        return LibPausable.layout().paused;
    }

    function pause() external onlyOwner override {
        LibPausable.layout().paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner override {
        LibPausable.layout().paused = false;
        emit Unpaused(msg.sender);
    }
}
