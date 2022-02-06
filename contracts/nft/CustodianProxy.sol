// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/interfaces/IERC1155.sol";
import "@openzeppelin/contracts/interfaces/IERC1155Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CustodianProxy is IERC1155Receiver, Ownable {
    constructor(address custodian) {
        transferOwnership(custodian);
    }

    function custody(address nft) onlyOwner external {
        IERC1155(nft).setApprovalForAll(owner(), true);
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public virtual override view returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
