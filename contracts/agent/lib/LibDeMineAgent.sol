// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableStorage.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/IDiamondLoupe.sol';
import "@openzeppelin/contracts/interfaces/IERC20.sol";

import '../../shared/lib/LibDiamond.sol';
import '../../nft/interfaces/IDeMineNFT.sol';
import '../facets/MortgageFacet.sol';
import '../facets/PrimaryMarketFacet.sol';
import '../facets/PaycheckFacet.sol';
import '../facets/BillingFacet.sol';

library LibDeMineAgent {
}
