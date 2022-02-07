// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/SafeOwnable.sol';
import '@solidstate/contracts/access/IERC173.sol';
import '@solidstate/contracts/introspection/IERC165.sol';
import '@solidstate/contracts/introspection/ERC165Storage.sol';
import '@solidstate/contracts/proxy/diamond/DiamondBase.sol';
import '@solidstate/contracts/proxy/diamond/DiamondCuttable.sol';
import '@solidstate/contracts/proxy/diamond/DiamondLoupe.sol';

import "@openzeppelin/contracts/proxy/Clones.sol";

import './lib/LibInitializable.sol';
import './lib/LibPausable.sol';

contract Diamond is
    IERC165,
    Initializable,
    Pausable,
    SafeOwnable,
    DiamondBase,
    DiamondCuttable,
    DiamondLoupe
{
    using ERC165Storage for ERC165Storage.Layout;
    using OwnableStorage for OwnableStorage.Layout;

    event Clone(address indexed from, address indexed cloned);

    struct InitArgs {
        address owner;
        bytes4[] interfaces;
        address fallbackAddress;
        bytes data;
    }

    function init(InitArgs calldata args) external initializer {
        OwnableStorage.layout().setOwner(args.owner);

        DiamondBaseStorage.Layout storage l = DiamondBaseStorage.layout();
        l.fallbackAddress = args.fallbackAddress;
        (
            bool success,
            bytes memory result
        ) = args.fallbackAddress.delegatecall(args.data);
        require(success, string(result));

        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        for (uint i; i < args.interfaces.length; i++) {
            erc165.setSupportedInterface(args.interfaces[i], true);
        }
    }

    function create(InitArgs memory args) external {
        address cloned = Clones.clone(address(this));
        Diamond(payable(cloned)).init(args);
        emit Clone(address(this), cloned);
    }

    function getFallbackAddress() external view returns (address) {
        return DiamondBaseStorage.layout().fallbackAddress;
    }

    function setSupportedInterface(bytes4 interfaceId, bool supported) onlyOwner external {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        erc165.setSupportedInterface(interfaceId, supported);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public virtual override view returns (bool) {
        ERC165Storage.Layout storage erc165 = ERC165Storage.layout();
        return interfaceId == type(IPausable).interfaceId ||
            interfaceId == type(IERC173).interfaceId ||
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IDiamondCuttable).interfaceId ||
            interfaceId == type(IDiamondLoupe).interfaceId ||
            erc165.isSupportedInterface(interfaceId);
    }

    receive() external payable { }
}
