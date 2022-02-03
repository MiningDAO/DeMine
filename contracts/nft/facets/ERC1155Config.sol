// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '../interfaces/IERC2981.sol';
import '../interfaces/IERC1155Rewardable.sol';
import './Base.sol';
import '@solidstate/contracts/token/ERC1155/metadata/ERC1155Metadata.sol';

abstract contract ERC1155Config is
    Base,
    IERC2981,
    IERC1155Rewardable,
    ERC1155Metadata
{
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
        return address(s.earningToken);
    }

    function alchemist() external override pure returns(address) {
        return _alchemist();
    }

    function _alchemist() internal pure returns(address) {
        return address(0x1A811678eEEDF16a1D0dF4b12e290F78a61A28F9);
    }
}
