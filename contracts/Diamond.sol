// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@solidstate/contracts/access/IERC173.sol';
import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import '@solidstate/contracts/proxy/diamond/DiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/DiamondLoupe.sol';
import './utils/Initializable.sol';
import './utils/IPausable.sol';
import './utils/Pausable.sol';

contract Diamond is
    Initializable,
    DiamondBase,
    DiamondCuttable,
    DiamondLoupe,
    SafeOwnable,
    Pausable,
    ERC165
{
    using DiamondBaseStorage for DiamondBaseStorage.Layout;
    using ERC165Storage for ERC165Storage.Layout;
    using OwnableStorage for OwnableStorage.Layout;

    function initialize() public initializer {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        bytes4[] memory selectors = new bytes4[](14);

        // register DiamondCuttable
        selectors[0] = IDiamondCuttable.diamondCut.selector;
        erc165.setSupportedInterface(type(IDiamondCuttable).interfaceId, true);

        // register DiamondLoupe
        selectors[1] = IDiamondLoupe.facets.selector;
        selectors[2] = IDiamondLoupe.facetFunctionSelectors.selector;
        selectors[3] = IDiamondLoupe.facetAddresses.selector;
        selectors[4] = IDiamondLoupe.facetAddress.selector;
        erc165.setSupportedInterface(type(IDiamondLoupe).interfaceId, true);

        // register ERC165
        selectors[5] = IERC165.supportsInterface.selector;
        erc165.setSupportedInterface(type(IERC165).interfaceId, true);

        // register SafeOwnable
        selectors[6] = Ownable.owner.selector;
        selectors[7] = SafeOwnable.nomineeOwner.selector;
        selectors[8] = SafeOwnable.transferOwnership.selector;
        selectors[9] = SafeOwnable.acceptOwnership.selector;
        erc165.setSupportedInterface(type(IERC173).interfaceId, true);

        // register Pausable
        selectors[10] = Pausable.paused.selector;
        selectors[11] = Pausable.pause.selector;
        selectors[12] = Pausable.unpause.selector;
        erc165.setSupportedInterface(type(IPausable).interfaceId, true);

        // register Diamond
        selectors[13] = Diamond.getFallbackAddress.selector;
        selectors[14] = Diamond.setFallbackAddress.selector;

        // diamond cut
        FacetCut[] memory facetCuts = new FacetCut[](1);
        facetCuts[0] = FacetCut({
            target: address(this),
            action: IDiamondCuttable.FacetCutAction.ADD,
            selectors: selectors
        });
        DiamondBaseStorage.layout().diamondCut(facetCuts, address(0), '');

        // set owner
        OwnableStorage.layout().setOwner(msg.sender);
    }

    constructor() initializer {}

    receive() external payable {}

    function getFallbackAddress() external view returns (address) {
        return DiamondBaseStorage.layout().fallbackAddress;
    }

    function setFallbackAddress(address fallbackAddress) external onlyOwner {
        DiamondBaseStorage.layout().fallbackAddress = fallbackAddress;
    }
}