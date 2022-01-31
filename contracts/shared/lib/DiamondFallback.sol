// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import './LibInitializable.sol';

abstract contract DiamondFallback is Initializable {
    function init(bytes memory args) internal virtual;

    function __DiamondFallback_init(bytes memory args) external onlyInitializing {
        init(args);
    }
}
