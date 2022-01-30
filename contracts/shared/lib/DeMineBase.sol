// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/access/IERC173.sol';
import '@solidstate/contracts/introspection/IERC165.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBaseStorage.sol';
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

    struct DiamondInit{
        address fallbackAddress;
        bytes4[] selectors;
        bytes32[] facetsSlotPosition;
        bytes32[] selectorSlots;
    }

    function __DeMineBase_init(
        DiamondInit memory d,
        address owner
    ) internal onlyInitializing {
        OwnableStorage.layout().owner = owner;
        DiamondBaseStorage.Layout storage l = DiamondBaseStorage.layout();
        l.fallbackAddress = d.fallbackAddress;
        l.selectorCount = uint16(d.selectors.length);
        for (uint i; i < d.selectors.length; i++) {
            l.facets[d.selectors[i]] = d.facetsSlotPosition[i];
        }
        for (uint i; i < d.selectorSlots.length; i++) {
            l.selectorSlots[i] = d.selectorSlots[i];
        }
    }

    function getFallbackAddress() external view returns (address) {
        return DiamondBaseStorage.layout().fallbackAddress;
    }

    function setFallbackAddress(address fallbackAddress) external {
        DiamondBaseStorage.layout().fallbackAddress = fallbackAddress;
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
