// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155Metadata.sol';

import '../interfaces/IERC2981.sol';
import '../interfaces/IERC1155Rewardable.sol';
import '../lib/AppStorage.sol';

abstract contract ERC1155Config is
    OwnableInternal,
    IERC2981,
    IERC1155Rewardable,
    ERC1155Metadata
{
    address constant _alchemist = address(
        0x1A811678eEEDF16a1D0dF4b12e290F78a61A28F9
    );
    address public immutable custodian;
    AppStorage internal s;

    constructor(address _custodian) {
        custodian = _custodian;
    }

    event TokenRoyaltyBpsSet(uint16);

    function setURI(string memory baseURI) external onlyOwner {
        _setBaseURI(baseURI);
    }

    function setRoyaltyInfo(address recipient, uint16 bps) external onlyOwner {
        s.royalty = RoyaltyInfo(recipient, bps);
        emit TokenRoyaltyBpsSet(bps);
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address, uint256)
    {
        RoyaltyInfo memory r = s.royalty;
        return (r.recipient, (value * r.bps) / 10000);
    }

    function earningToken() external override view returns(address) {
        return s.earningToken;
    }

    function alchemist() external override pure returns(address) {
        return _alchemist;
    }

    function finalized() external view returns(uint128) {
        return s.finalized;
    }

    function supplyOf(uint id) external view returns(uint) {
        return s.supply[id];
    }

    function supplyOfBatch(
        uint[] calldata ids
    ) external view returns(uint[] memory) {
        uint[] memory res = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            res[i] = s.supply[ids[i]];
        }
        return res;
    }
}
