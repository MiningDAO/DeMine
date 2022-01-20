// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/proxy/diamond/DiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/DiamondLoupe.sol';

contract DiamondFacet is DiamondCuttable, DiamondLoupe, ERC165 { }
