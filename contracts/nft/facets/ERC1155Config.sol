// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
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
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    address immutable _custodian;
    AppStorage internal s;

    constructor(address c) {
        _custodian = c;
        s.status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(s.status != _ENTERED, "ReentrancyGuard: reentrant call");
        s.status = _ENTERED;
        _;
        s.status = _NOT_ENTERED;
    }

    function setURI(string memory baseURI) external onlyOwner {
        _setBaseURI(baseURI);
    }

    function setRoyaltyInfo(address recipient, uint16 bps) external onlyOwner {
        s.royalty = RoyaltyInfo(recipient, bps);
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

    function custodian() external override view returns(address) {
        return _custodian;
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

    function earning(uint tokenId) external view returns(uint) {
        uint128 start = uint128(tokenId >> 128);
        uint128 end = uint128(tokenId);
        return _earning(start, end);
    }

    function earningBatch(
        uint[] calldata ids
    ) external view returns(uint[] memory) {
        uint[] memory res = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            uint128 start = uint128(ids[i] >> 128);
            uint128 end = uint128(ids[i]);
            res[i] = _earning(start, end);
        }
        return res;
    }

    function _earning(uint128 start, uint128 end)
        internal
        view
        returns(uint value)
    {
        // daily token
        if (end - start == 86400) {
            value = s.daily[end];
        // weekly token
        } else if (end - start == 604800) {
            value = s.weekly[end];
        // biweekly token
        } else if (end - start == 1209600) {
            value = s.weekly[end] + s.weekly[end - 604800];
        }
    }
}
