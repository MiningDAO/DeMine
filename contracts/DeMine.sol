// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';

contract DeMine is DiamondBase {
    constructor(address diamondBase) {
        DiamondBaseStorage.layout().fallbackAddress = diamondBase;
    }

    receive() external payable {}
}
