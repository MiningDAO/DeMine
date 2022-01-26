// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';

import '../shared/lib/DeMineBase.sol';
import '../nft/interfaces/IMiningPool.sol';
import './lib/AppStorage.sol';

contract DeMineAgent is DeMineBase {
    AppStorage internal s;

    function initialize(
        address owner,
        address diamondFacet,
        address mortgageFacet,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        address nft,
        address payment,
        address payee,
        uint256 tokenCost
    ) external initializer {
        __DeMineBase_init(diamondFacet, mortgageFacet, facetCuts, owner);
        s.nft = nft;
        s.income = IERC20(IMiningPool(nft).treasureSource());
        s.payment = IERC20(payment);
        s.payee = payee;
        s.tokenCost = tokenCost;
    }

    function create(
        address owner,
        address diamondFacet,
        address mortgageFacet,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        address nft,
        address payment,
        address payee,
        uint256 tokenCost
    ) external {
        address cloned = _clone();
        DeMineAgent(payable(cloned)).initialize(
            owner, diamondFacet, mortgageFacet, facetCuts, nft, payment, payee, tokenCost
        );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public override(DeMineBase) view returns (bool) {
        return super.supportsInterface(interfaceId) ||
            interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
