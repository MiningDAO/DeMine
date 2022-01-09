// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondLoupe.sol';

import '../../shared/lib/LibDiamond.sol';
import '../facets/AgentAdminFacet.sol';
import '../facets/PoolAdminFacet.sol';
import '../facets/ExternalFacet.sol';

library LibDeMineAgent {
    using OwnableStorage for OwnableStorage.Layout;

    function genCutAgentAdmin(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = AgentAdminFacet.createPoolWithSupply.selector;
        selectors[1] = AgentAdminFacet.addSupply.selector;
        selectors[2] = AgentAdminFacet.cashout.selector;
        selectors[3] = AgentAdminFacet.reward.selector;
        selectors[4] = AgentAdminFacet.poolInfo.selector;
        selectors[5] = AgentAdminFacet.cycleInfo.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }

    function genCutPoolAdmin(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](8);
        selectors[0] = PoolAdminFacet.increaseAllowance.selector;
        selectors[1] = PoolAdminFacet.decreaseAllowance.selector;
        selectors[2] = PoolAdminFacet.transferPool.selector;
        selectors[3] = PoolAdminFacet.setTokenDefaultPrice.selector;
        selectors[4] = PoolAdminFacet.setTokenPrice.selector;
        selectors[5] = PoolAdminFacet.redeem.selector;
        selectors[6] = PoolAdminFacet.getAllowance.selector;
        selectors[7] = PoolAdminFacet.getPrices.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }

    function genCutExternal(
        address target
    ) internal returns(IDiamondCuttable.FacetCut memory) {
        bytes4[] memory selectors = new bytes4[](8);
        selectors[0] = ExternalFacet.claimUnnamed.selector;
        selectors[1] = ExternalFacet.claim.selector;
        selectors[2] = ExternalFacet.cashout.selector;
        return LibDiamond.genFacetCut(target, selectors);
    }

    function initialize(
        address nft,
        address diamondFacet,
        address agentAdminFacet,
        address poolAdminFacet,
        address externalFacet
    ) external {
        OwnableStorage.layout().setOwner(msg.sender);
        IDiamondCuttable.FacetCut[] memory facetCuts = new IDiamondCuttable.FacetCut[](4);
        facetCuts[0] = LibDiamond.genCutDiamond(diamondFacet);
        facetCuts[1] = genCutERC2981(erc2981Facet);
        facetCuts[2] = genCutERC1155Metadata(erc1155MetadataFacet);
        facetCuts[3] = genCutERC1155WithAgent(erc1155WithAgentFacet);
        (bool success, bytes memory returndata) = diamondFacet.delegatecall(
            abi.encodeWithSelector(
                IDiamondCuttable.diamondCut.selector,
                facetCuts,
                address(0),
                ""
            )
        );
        require(success, string(returndata));
    }
}
