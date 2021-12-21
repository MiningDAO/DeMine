// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

interface IDeMineNFT {
    function mint(address, uint256[] calldata, uint256[] calldata) external;
    function pause() external;
    function unpause() external;
}
