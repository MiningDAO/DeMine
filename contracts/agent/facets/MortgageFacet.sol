// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/introspection/ERC165.sol';
import '@solidstate/contracts/token/ERC1155/IERC1155Receiver.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '../../shared/lib/Util.sol';
import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';
import '../lib/BillingStorage.sol';
import '../../shared/lib/LibInitializable.sol';

/**
 * @title MortgageFacet
 * @author Shu Dong, Yijie Hong
 * @notice Facet contract holding functions for miners to manage mortgage.
 * @notice Facet contract currently only supports weekly NFT token.
 * @dev the contract also implements IERC1155Receiver to receive and lock demine nft
 */
contract MortgageFacet is
    Initializable,
    PausableModifier,
    IERC1155Receiver,
    ERC165
{
    AppStorage internal s;

    using SafeERC20 for IERC20;

    event Redeem(address indexed, uint[], uint[]);

    function init(
        address nft,
        address payment,
        address payee,
        uint tokenCost
    ) external onlyInitializing {
        IERC1155Rewardable nftContract = IERC1155Rewardable(nft);
        s.nft = nftContract;
        s.incomeToken = IERC20(nftContract.earningToken());
        s.paymentToken = IERC20(payment);
        s.payee = payee;
        s.tokenCost = tokenCost;
    }

    /**
     * @notice Pay token cost and liquidize tokens
     * @param ids DeMine nft token ids to redeem
     * @param amounts Amount of each demine nft token
     */
    function redeemNFT(
        uint256[] calldata ids,
        uint[] calldata amounts
    ) external whenNotPaused {
        require(
            ids.length == amounts.length,
            "DeMineAgent: array length mismatch");
        uint tokenCost = s.tokenCost;
        uint128 billedTime = s.billedTime;

        uint totalCost;
        for (uint i = 0; i < ids.length; i++) {
            require(
                tokenIdToStart(ids[i]) >= billedTime,
                "DeMineAgent: cannot redeem NFT for ongoing/completed mining.");
            totalCost += tokenCost * amounts[i] * daysInToken(ids[i]);
            uint balance = s.balances[ids[i]][msg.sender];
            require(balance > 0 && balance > amounts[i], 'DeMineAgent: no sufficient balance');
            s.balances[ids[i]][msg.sender] = balance - amounts[i];
        }
        if (totalCost > 0) {
            s.paymentToken.safeTransferFrom(msg.sender, s.payee, totalCost);
        }
        emit Redeem(msg.sender, ids, amounts);
        s.nft.safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
    }

    function balanceOfBatch(
        address account,
        uint256[] calldata ids
    ) external view returns(uint[] memory) {
        uint[] memory balances = new uint[](ids.length);
        for (uint i = 0; i < ids.length; i++) {
            balances[i] = s.balances[ids[i]][account];
        }
        return balances;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return 0; // reject
    }

    // @dev the function should only be called by mint function of DeMineNFT
    // @param from Must be address(0)
    // @param data Must be encoded address of mortagager
    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external override returns (bytes4) {
        require(
            msg.sender == address(s.nft) && from == address(0),
            'DeMineAgent: only minted tokens from DeMineNFT allowed'
        );
        (address mortgager) = abi.decode(data, (address));
        for (uint i = 0; i < ids.length; i++) {
            uint balance = s.balances[ids[i]][mortgager] + amounts[i];
            s.balances[ids[i]][mortgager] = balance;
        }
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    /**
     * @notice Withdraw surplus or payoff debt for NFT tokens that have been billed.
     *         All balances of ids need to be paid off or withdrawn. Partial payoff
     *         or withdraw is not supported.
     */
    function withdrawAndPayoff(
        uint256[] calldata ids
    ) external whenNotPaused {
        uint income;
        uint debt;
        uint128 billedTime = s.billedTime;

        for (uint i = 0; i < ids.length; i++) {
            require(
                tokenIdToEnd(ids[i]) <= billedTime,
                "DeMineAgent: cannot withdraw or payoff NFT for not yet billed mining.");
            BillingStatement memory st = s.statements[ids[i]];
            uint balance = s.balances[ids[i]][msg.sender];
            income += st.surplus * balance / st.balance;
            debt += st.debt * balance / st.balance;
            delete s.balances[ids[i]][msg.sender];
        }

        if (debt > 0) {
            s.paymentToken.safeTransferFrom(s.payee, msg.sender, debt);
        }
        if (income > 0) {
            s.incomeToken.safeTransfer(msg.sender, income);
        }
    }

    function tokenIdToStart(uint256 tokenId) private pure returns(uint128) {
        return uint128(tokenId >> 128);
    }

    function tokenIdToEnd(uint256 tokenId) private pure returns(uint128) {
        return uint128(tokenId);
    }

    function daysInToken(uint256 tokenId) private pure returns(uint) {
        return (tokenIdToEnd(tokenId) - tokenIdToStart(tokenId)) / 86400;
    }
}
