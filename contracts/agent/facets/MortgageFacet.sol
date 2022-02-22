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

    function init(
        address nftAddr,
        address paymentTokenAddr,
        address custodianAddr,
        uint costPerToken,
        address[] calldata pricingStrategies,
        address[] calldata allowanceStrategies
    ) external onlyInitializing {
        IERC1155Rewardable nftContract = IERC1155Rewardable(nftAddr);
        s.nft = nftContract;
        s.paymentToken = paymentTokenAddr;
        s.custodian = custodianAddr;
        s.tokenCost = costPerToken;
        for (uint i = 0; i < pricingStrategies.length; i++) {
            s.strategyRegistry[pricingStrategies[i]] = 1;
        }
        for (uint i = 0; i < allowanceStrategies.length; i++) {
            s.strategyRegistry[allowanceStrategies[i]] = 2;
        }
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
            "DeMineAgent: array length mismatch"
        );
        uint costPerToken = s.tokenCost;

        uint totalCost;
        for (uint i = 0; i < ids.length; i++) {
            totalCost += costPerToken * amounts[i] * daysInToken(ids[i]);
            uint balance = s.balances[ids[i]][msg.sender];
            require(balance > 0 && balance > amounts[i], 'DeMineAgent: no sufficient balance');
            s.balances[ids[i]][msg.sender] = balance - amounts[i];
        }
        if (totalCost > 0) {
            IERC20(s.paymentToken).safeTransferFrom(msg.sender, s.custodian, totalCost);
        }
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

    function billingStatementOfBatch(
        uint[] calldata tokenIds
    ) external view returns(BillingStatement[] memory) {
        BillingStatement[] memory res = new BillingStatement[](tokenIds.length);
        for (uint i = 0; i < tokenIds.length; i++) {
            res[i] = s.statements[tokenIds[i]];
        }
        return res;
    }

    function nft() external view returns(address) {
        return address(s.nft);
    }

    function custodian() external view returns(address) {
        return s.custodian;
    }

    function paymentToken() external view returns(address) {
        return s.paymentToken;
    }

    function tokenCost() external view returns(uint) {
        return s.tokenCost;
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
            from == s.nft.custodian(),
            'DeMineAgent: only tokens from custodian allowed'
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

        for (uint i = 0; i < ids.length; i++) {
            BillingStatement memory st = s.statements[ids[i]];
            uint balance = s.balances[ids[i]][msg.sender];
            income += st.surplus * balance / st.balance;
            debt += st.debt * balance / st.balance;
            delete s.balances[ids[i]][msg.sender];
        }

        if (debt > 0) {
            IERC20(s.paymentToken).safeTransferFrom(s.custodian, msg.sender, debt);
        }
        if (income > 0) {
            IERC20(s.nft.earningToken()).safeTransfer(msg.sender, income);
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

    function getTokenCost() external view returns(uint) {
        return s.tokenCost;
    }
}
