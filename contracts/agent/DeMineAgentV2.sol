// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '../shared/lib/DeMineBaseV2.sol';
import './lib/AppStorage.sol';

contract DeMineAgentV2 is DeMineBaseV2 {
    AppStorage internal s;

    function initialize(
        address diamond,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        bytes4[] calldata interfaces,
        uint256 tokenCost,
        address income,
        address payment,
        address nft
    ) external initializer {
        __DeMineBaseV2_init(diamond, facetCuts, interfaces);
        s.nft = nft;
        s.tokenCost = tokenCost;
        s.income = IERC20(income);
        s.payment = IERC20(payment);
    }
}
