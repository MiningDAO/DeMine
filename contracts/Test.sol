// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "./IDeMineNFTAdmin.sol";
import "./IDeMineNFT.sol";

contract DeMineNFTAdminTest is IDeMineNFTAdmin {
    event Redeem(address, uint256, uint256, uint256[], uint256[]);
    function redeem(
        address sender,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external override {
        emit Redeem(sender, 1, 1, tokenIds, amounts);
    }
}
