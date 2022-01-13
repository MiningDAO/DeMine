// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondLoupe.sol';

import '../../shared/lib/LibDiamond.sol';
import '../facets/MortagageFacet.sol';
import '../facets/PrimaryMarketFacet.sol';
import '../facets/DeMineNFTFacet.sol';

library LibDeMineAgent {
    using OwnableStorage for OwnableStorage.Layout;

    function genCutMortagage(
        address target
    ) internal pure returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = MortagageFacet.mortgage.selector;
        selectors[1] = MortagageFacet.transferMortgage.selector;
        selectors[2] = MortagageFacet.redeem.selector;
        selectors[3] = MortagageFacet.onERC1155Received.selector;
        selectors[4] = MortagageFacet.onERC1155BatchReceived.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }

    function genCutPrimaryMarket(
        address target
    ) internal pure returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](10);
        selectors[0] = PrimaryMarketFacet.increaseAllowance.selector;
        selectors[1] = PrimaryMarketFacet.decreaseAllowance.selector;
        selectors[2] = PrimaryMarketFacet.claimUnnamed.selector;
        selectors[3] = PrimaryMarketFacet.claim.selector;
        selectors[4] = PrimaryMarketFacet.getAllowances.selector;
        selectors[5] = PrimaryMarketFacet.setPricingStrategy.selector;
        selectors[6] = PrimaryMarketFacet.tokenPrices.selector;
        selectors[7] = PrimaryMarketFacet.setStaticBase.selector;
        selectors[8] = PrimaryMarketFacet.setStaticOverride.selector;
        selectors[9] = PrimaryMarketFacet.setLinearPricing.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }

    function genCutERC20Rewardable(
        address target
    ) internal pure returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = ERC20RewardableFacet.reward.lector;
        selectors[1] = ERC20RewardableFacet.cashout.selector;
        selectors[2] = ERC20RewardableFacet.billing.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }

    function genCutERC20Payable(
        address target
    ) internal pure returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = ERC20PayableFacet.addPayment.lector;
        selectors[1] = ERC20PayableFacet.removePayment.selector;
        selectors[2] = ERC20PayableFacet.supportedPayments.selector;
        selectors[3] = ERC20PayableFacet.setCustodian.selector;
        selectors[4] = ERC20PayableFacet.getCustodian.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }

    function initialize(
        address diamondFacet,
        address mortgageFacet,
        address primaryMarketFacet,
        address erc20RewardableFacet,
        address erc20PayableFacet,
        // AgentAdmin initialization args
        uint256 tokenCost,
        address rewardToken,
        address[] memory payments,
        address custodian,
        address demineNFT
    ) external {
        IDiamondCuttable.FacetCut[] memory facetCuts = new IDiamondCuttable.FacetCut[](5);
        facetCuts[0] = LibDiamond.genCutDiamond(diamondFacet);
        facetCuts[1] = genCutMortagage(mortgageFacet);
        facetCuts[2] = genCutPrimaryMarket(primaryMarketFacet);
        facetCuts[3] = genCutERC20Rewardable(erc20RewardableFacet);
        facetCuts[4] = genCutERC20Payable(erc20PayableFacet);

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
        s.custodian = custodian;
        s.rewardToken = rewardToken;
        for (uint256 i = 0; i < payments.length; i++) {
            s.payments.add(payments[i]);
        }
    }
}
