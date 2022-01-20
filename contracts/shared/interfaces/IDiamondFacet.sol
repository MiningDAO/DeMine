// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';

interface IDiamondFacet {
    function genFacetCutAdd() external returns(IDiamondCuttable.FacetCut memory);
}

