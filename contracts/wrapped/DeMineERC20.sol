// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import '@solidstate/contracts/token/ERC20/IERC20.sol';
import '@solidstate/contracts/token/ERC20/metadata/ERC20MetadataStorage.sol';

import '../shared/lib/DeMineBase.sol';

contract DeMineERC20 is DeMineBase {
    function initialize(
        address owner,
        address diamondFacet,
        address erc20Facet,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) external initializer {
        __DeMineBase_init(diamondFacet, erc20Facet, facetCuts, owner);
        ERC20MetadataStorage.Layout storage l = ERC20MetadataStorage.layout();
        l.name = name;
        l.symbol = symbol;
        l.decimals = decimals;
    }

    function create(
        address owner,
        address diamondFacet,
        address erc20Facet,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) external {
        address cloned = _clone();
        DeMineERC20(payable(cloned)).initialize(
            owner, diamondFacet, erc20Facet, facetCuts, name, symbol, decimals
        );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public override(DeMineBase) view returns (bool) {
        return super.supportsInterface(interfaceId) ||
            interfaceId == type(IERC20).interfaceId;
    }
}
