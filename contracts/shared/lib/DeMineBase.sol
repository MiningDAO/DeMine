// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/access/IERC173.sol';
import '@solidstate/contracts/introspection/IERC165.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import "@openzeppelin/contracts/proxy/Clones.sol";

import '../facets/DiamondFacet.sol';
import './LibInitializable.sol';
import './LibPausable.sol';

abstract contract DeMineBase is
    IERC165,
    DiamondBase,
    Initializable,
    Pausable,
    SafeOwnable
{
    event Clone(address indexed from, address indexed cloned);

    using OwnableStorage for OwnableStorage.Layout;

    function __DeMineBase_init(
        address diamondFacet,
        address fallbackAddress,
        IDiamondCuttable.FacetCut[] calldata facetCuts,
        address owner
    ) internal onlyInitializing {
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
        // set fallback address
        (success, returndata) = diamondFacet.delegatecall(
            abi.encodeWithSelector(
                DiamondFacet.setFallbackAddress.selector,
                fallbackAddress
            )
        );
        require(success, string(returndata));
        OwnableStorage.layout().setOwner(owner);
    }

    function _clone() internal returns(address cloned) {
        cloned = Clones.clone(address(this));
        emit Clone(address(this), cloned);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public virtual override view returns (bool) {
        return interfaceId == type(IPausable).interfaceId ||
            interfaceId == type(IERC173).interfaceId ||
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IDiamondCuttable).interfaceId ||
            interfaceId == type(IDiamondLoupe).interfaceId;
    }

    receive() external payable { }
}
