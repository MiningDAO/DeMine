// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import './PausableStorage.sol';

abstract contract PausableInternal {
    using PausableStorage for PausableStorage.Layout;

    modifier whenPaused() {
        require(PausableStorage.layout().paused, 'Pausable: not paused');
        _;
    }

    modifier whenNotPaused() {
        require(!PausableStorage.layout().paused, 'Pausable: paused');
        _;
    }
}
