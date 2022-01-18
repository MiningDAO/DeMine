// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondLoupe.sol';
import "@openzeppelin/contracts/interfaces/IERC20.sol";

import '../shared/lib/LibDiamond.sol';
import '../nft/interfaces/IDeMineNFT.sol';
import './facets/MortgageFacet.sol';
import './facets/PrimaryMarketFacet.sol';
import './facets/BillingFacet.sol';

contract DeMineAgent is DiamondBase {
    using OwnableStorage for OwnableStorage.Layout;
    constructor(
        address diamondFacet,
        address mortgageFacet,
        address primaryMarketFacet,
        address billingFacet,
        // AgentAdmin initialization args
        uint256 tokenCost,
        address income,
        address cost,
        address demineNFT
    ) {
        IDiamondCuttable.FacetCut[] memory facetCuts = new IDiamondCuttable.FacetCut[](4);
        facetCuts[0] = LibDiamond.genCutDiamond(diamondFacet);
        facetCuts[1] = genCutMortagage(mortgageFacet);
        facetCuts[2] = genCutPrimaryMarket(primaryMarketFacet);
        facetCuts[3] = genCutBilling(billingFacet);

        OwnableStorage.layout().setOwner(msg.sender);
        (bool success, bytes memory returndata) = diamondFacet.delegatecall(
            abi.encodeWithSelector(
                IDiamondCuttable.diamondCut.selector,
                facetCuts,
                address(0),
                ""
            )
        );
        require(success, string(returndata));

        // init storage
        AppStorage storage s = LibAppStorage.layout();
        s.nft = demineNFT;
        s.tokenCost = tokenCost;
        s.income = IERC20(income);
        s.cost = IERC20(cost);
    }

    function genCutMortagage(
        address target
    ) internal pure returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = MortgageFacet.mortgage.selector;
        selectors[1] = MortgageFacet.redeem.selector;
        selectors[2] = MortgageFacet.close.selector;
        selectors[3] = MortgageFacet.getMortgage.selector;
        selectors[4] = MortgageFacet.onERC1155Received.selector;
        selectors[5] = MortgageFacet.onERC1155BatchReceived.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }

    function genCutPrimaryMarket(
        address target
    ) internal pure returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](9);
        selectors[0] = PrimaryMarketFacet.setPricingStrategy.selector;
        selectors[1] = PrimaryMarketFacet.increaseAllowance.selector;
        selectors[2] = PrimaryMarketFacet.decreaseAllowance.selector;
        selectors[3] = PrimaryMarketFacet.claim.selector;
        selectors[4] = PrimaryMarketFacet.getListedPrices.selector;
        selectors[5] = PrimaryMarketFacet.getAllowances.selector;
        selectors[6] = PricingStatic.setStaticBase.selector;
        selectors[7] = PricingStatic.setStaticOverride.selector;
        selectors[8] = PricingLinearDecay.setLinearDecay.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }

    function genCutBilling(
        address target
    ) internal pure returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = BillingFacet.finalize.selector;
        selectors[1] = BillingFacet.lockPrice.selector;
        selectors[2] = BillingFacet.buyWithLockedPrice.selector;
        selectors[3] = BillingFacet.manualCloseBilling.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }
}
