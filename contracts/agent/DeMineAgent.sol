// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';

import '../shared/lib/DeMineBase.sol';
import '../nft/interfaces/IMiningPool.sol';
import './lib/AppStorage.sol';

contract DeMineAgent is DeMineBase {
    AppStorage internal s;

    function initialize(
        address diamondFacet,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        bytes4[] calldata interfaces,
        address nft,
        address payment,
        address payee,
        uint256 tokenCost,
        address owner
    ) external initializer {
        __DeMineBase_init(diamondFacet, facetCuts, interfaces, owner);
        s.nft = nft;
        s.income = IERC20(IMiningPool(nft).treasureSource());
        s.payment = IERC20(payment);
        s.payee = payee;
        s.tokenCost = tokenCost;
    }

    function create(
        address diamondFacet,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        bytes4[] calldata interfaces,
        address nft,
        address payment,
        address payee,
        uint256 tokenCost,
        address owner
    ) external {
        DeMineAgent(clone()).initialize(
            diamondFacet, facetCuts, interfaces, nft, payment, payee, tokenCost, owner
        );
    }
}
