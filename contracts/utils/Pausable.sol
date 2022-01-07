// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/OwnableInternal.sol';
import './IPausable.sol';
import './PausableInternal.sol';

abstract contract Pausable is IPausable, PausableInternal, OwnableInternal {
    function paused() public override view returns(bool) {
        return PausableStorage.layout().paused;
    }

    function pause() external override onlyOwner {
        PausableStorage.layout().paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external override onlyOwner {
        PausableStorage.layout().paused = false;
        emit Unpaused(msg.sender);
    }
}
