// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/DiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/DiamondLoupe.sol';

contract DiamondFacet is DiamondCuttable, DiamondLoupe {
    function getFallbackAddress() external view returns (address) {
        return DiamondBaseStorage.layout().fallbackAddress;
    }

    function setFallbackAddress(address fallbackAddress) external {
        DiamondBaseStorage.layout().fallbackAddress = fallbackAddress;
    }
}
