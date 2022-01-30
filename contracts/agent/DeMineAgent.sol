// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/proxy/diamond/IDiamondCuttable.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';

import '../nft/interfaces/IERC1155Rewardable.sol';
import '../shared/lib/DeMineBase.sol';
import './lib/AppStorage.sol';

contract DeMineAgent is DeMineBase {
    AppStorage internal s;

    function initialize(
        address owner,
        DiamondInit memory d,
        address nft,
        address payment,
        address payee,
        uint256 tokenCost
    ) external initializer {
        __DeMineBase_init(d, owner);
        IERC1155Rewardable nftContract = IERC1155Rewardable(nft);
        s.nft = nftContract;
        s.income = IERC20(nftContract.getRewardToken());
        s.payment = IERC20(payment);
        s.payee = payee;
        s.tokenCost = tokenCost;
    }

    function create(
        address owner,
        DiamondInit memory d,
        address nft,
        address payment,
        address payee,
        uint256 tokenCost
    ) external {
        address cloned = _clone();
        DeMineAgent(payable(cloned)).initialize(
            owner, d, nft, payment, payee, tokenCost
        );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public override(DeMineBase) view returns (bool) {
        return super.supportsInterface(interfaceId) ||
            interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
