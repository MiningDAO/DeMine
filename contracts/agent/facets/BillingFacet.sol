// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import '../../nft/interfaces/IERC1155Rewardable.sol';
import '../../shared/lib/LibPausable.sol';
import '../lib/AppStorage.sol';

/**
 * @title BillingFacet
 * @author Shu Dong
 * @notice billing related functions
 */
contract BillingFacet is PausableModifier, OwnableInternal {
    AppStorage internal s;

    using SafeERC20 for IERC20;

    /**
     * @notice It will try to sell earning token at Uniswap
     * to pay bill and start earning token sale if it fails
     */
    function tryBilling(uint tokenId) external onlyOwner {
        IERC1155Rewardable nft = s.nft;
        uint balance = nft.balanceOf(address(this), tokenId);
        if (balance == 0) {
            return;
        }
        uint debt = s.tokenCost * balance;
        IERC20 earningToken = IERC20(s.nft.earningToken());
        uint prevBalance = earningToken.balanceOf(address(this));
        nft.safeTransferFrom(
            address(this), nft.custodian(), tokenId, balance, ''
        );
        uint earning = earningToken.balanceOf(address(this)) - prevBalance;
        if (earning == 0) {
            s.statements[tokenId].balance = balance;
            s.statements[tokenId].debt = debt;
            return;
        }
        (uint earningTokenLeft, uint paymentTokenReceived) = trySwap(
            s.swapRouter,
            address(earningToken),
            address(s.paymentToken),
            earning,
            debt
        );
        if (paymentTokenReceived == debt) {
            s.statements[tokenId].balance = balance;
            s.statements[tokenId].surplus = earningTokenLeft;
        } else {
            s.statements[tokenId] = BillingStatement(
                balance,
                earningTokenLeft,
                debt - paymentTokenReceived,
                block.timestamp + 86400
            );
        }
    }

    /**
     * @notice purchase on sale earning token to pay debt
     * @param tokenId token id to get statement
     * @param debtToPay Amount of debt to pay
     */
    function purchaseEarningTokenOnSale(
        uint tokenId,
        uint debtToPay
    ) external whenNotPaused {
        BillingStatement memory st = s.statements[tokenId];
        require(
            st.surplus > 0 && st.debt > 0,
            'Mining3Agent: no debt to pay or no earning token for sale'
        );
        if (debtToPay > st.debt) {
            debtToPay = st.debt;
        }

        IERC20 earningToken = IERC20(s.nft.earningToken());
        IERC20 paymentToken = IERC20(s.paymentToken);
        uint sold = swapTokens(
            s.chainlink,
            IERC20Metadata(address(earningToken)),
            IERC20Metadata(address(paymentToken)),
            s.earningTokenSaleDiscount10000Based,
            debtToPay
        );
        // no enough surplus token to pay
        if (sold > st.surplus) {
            debtToPay = debtToPay * st.surplus / sold;
            s.statements[tokenId].surplus = 0;
            s.statements[tokenId].debt = st.debt - debtToPay;
        } else {
            s.statements[tokenId].surplus = st.surplus - sold;
            s.statements[tokenId].debt = 0;
        }
        IERC20(paymentToken).safeTransferFrom(
            msg.sender, s.custodian, debtToPay
        );
        IERC20(earningToken).safeTransfer(msg.sender, sold);
    }

    function swapTokens(
        AggregatorV3Interface chainlink,
        IERC20Metadata earningToken,
        IERC20Metadata paymentToken,
        uint discount,
        uint amountIn // payment token
    ) private view returns(uint) {
        (,int price, , ,) = chainlink.latestRoundData();
        if (price <= 0) { return 0; }
        uint discountedPrice = uint(price) * discount / 10000;

        uint8 amountOutDecimals = earningToken.decimals();
        uint8 amountInDecimals = paymentToken.decimals();
        uint8 priceDecimals = chainlink.decimals();
        if (amountOutDecimals + priceDecimals > amountInDecimals) {
            uint base = 10 ** (amountOutDecimals + priceDecimals - amountInDecimals);
            return amountIn * base / discountedPrice;
        } else {
            uint base = 10 ** (amountInDecimals - amountOutDecimals - priceDecimals);
            return amountIn / (discountedPrice * base);
        }
    }

    function trySwap(
        address swapRouter,
        address tokenIn,
        address tokenOut,
        uint amountInMax,
        uint amountOut
    ) internal returns(uint, uint) {
        TransferHelper.safeApprove(tokenIn, swapRouter, amountInMax);
        (bool success, bytes memory encoded) = swapRouter.call(
            abi.encodeWithSignature(
                'swapTokensForExactTokens(uint,uint,address[],address,uint)',
                amountOut, amountInMax, [tokenIn, tokenOut], address(this), block.timestamp
            )
        );
        TransferHelper.safeApprove(tokenIn, swapRouter, 0);
        if (success) {
            return abi.decode(encoded, (uint, uint));
        } else {
            return (amountInMax, 0);
        }
    }
}
