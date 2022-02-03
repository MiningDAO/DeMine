// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import '@solidstate/contracts/access/OwnableInternal.sol';

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

import '../../nft/interfaces/IERC1155Rewardable.sol';
import '../../shared/lib/LibPausable.sol';
import '../../shared/lib/Util.sol';
import '../lib/AppStorage.sol';
import '../lib/BillingStorage.sol';

/**
 * @title BillingFacet
 * @author Shu Dong
 * @notice billing related functions
 */
contract BillingFacet is PausableModifier, OwnableInternal {
    AppStorage internal s;

    using SafeERC20 for IERC20;

    event RewardTokenSold(address indexed billing, uint sold, uint paid);
    event CloseBilling(uint indexed billing);
    event BillingSale(uint indexed, uint expireAt);
    event LockPrice(uint indexed, uint indexed);
    event Withdraw(address indexed recipient, uint amount);

    /**
     * @notice withdraw payment from contract
     * @param recipient Address of account to accept payment
     * @param amount Amount to withdraw
     */
    function withdraw(address recipient, uint amount) external onlyOwner {
        s.payment.safeTransfer(recipient, amount);
        emit Withdraw(recipient, amount);
    }

    /**
     * @notice It will try to sell income token at Uniswap
     * to pay bill and start income token sale if it fails
     */
    function tryBilling() external onlyOwner {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(
            l.stage == BillingStorage.Stage.NOT_STARTED,
            'DeMineAgent: billing in progress'
        );
        uint billing = s.billing;
        IERC1155Rewardable nft = s.nft;
        uint balance = nft.balanceOf(address(this), billing);
        uint debt = s.tokenCost * balance;
        if (debt == 0) {
            close(l, billing);
            return;
        }
        address alchemist = nft.alchemist();
        uint prevBalance = s.income.balanceOf(address(this));
        nft.safeTransferFrom(
            address(this), alchemist, billing, balance, ''
        );
        uint income = s.income.balanceOf(address(this)) - prevBalance;
        if (income == 0) {
            s.statements[billing].balance = balance;
            s.statements[billing].debt = debt;
            s.deposit -= s.statements[billing].debt;
            close(l, billing);
            return;
        }
        (bool success, uint sold) = trySwap(
            l.swapRouter, address(s.income), address(s.payment), income, debt
        );
        if (success) {
            s.statements[billing].balance = balance;
            s.statements[billing].income = income - sold;
            close(l, billing);
        } else {
            s.statements[billing] = Statement(balance, income, debt);
            uint saleExpireAt = block.timestamp + l.saleDuration;
            l.saleExpireAt = saleExpireAt;
            l.stage = BillingStorage.Stage.SALE_ONGOING;
            emit BillingSale(billing, saleExpireAt);
        }
    }

    /**
     * @notice lock price to buy income token in income token sale
     */
    function lockPrice() external returns(uint unitSize, uint unitPrice) {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(
            l.stage == BillingStorage.Stage.SALE_ONGOING,
            'DeMineAgent: no sale on-going'
        );
        Statement memory st = s.statements[s.billing];
        uint price = getNormalizedChainlinkPriceWithDiscount(l);
        uint incomeBase = base(s.income);
        uint maxCostTokenTraded = price * st.income / incomeBase;
        (unitSize, unitPrice) = maxCostTokenTraded > st.debt
            ? calcUnitPrice(price, incomeBase)
            : calcUnitPrice(st.debt, st.income);
        l.lockedPrices[msg.sender] = BillingStorage.LockedPrice(
            unitSize, unitPrice, block.timestamp + l.priceLockDuration
        );
        emit LockPrice(unitSize, unitPrice);
    }

    /**
     * @notice buy income token with locked price
     * @param maxToPay The max amount of cost to pay
     */
    function buyWithLockedPrice(uint maxToPay) external {
        BillingStorage.Layout storage l = BillingStorage.layout();
        require(
            l.stage == BillingStorage.Stage.SALE_ONGOING,
            'DeMineAgent: no sale on-going'
        );
        BillingStorage.LockedPrice memory p = l.lockedPrices[msg.sender];
        require(block.timestamp < p.expireAt, 'DeMineAgent: price expired');
        uint billing = s.billing;
        Statement memory st = s.statements[billing];
        uint unitToBuy = Util.min3(
            maxToPay / p.unitPrice,
            Util.ceil(st.debt, p.unitPrice),
            st.income / p.unitSize
        );
        uint checkout = unitToBuy * p.unitPrice;
        uint rewardTokenSold = unitToBuy * p.unitSize;
        s.statements[billing].income = st.income - rewardTokenSold;
        if (checkout < st.debt) {
            s.statements[billing].debt = st.debt - checkout;
        } else {
            s.statements[billing].debt = 0;
            close(l, s.billing);
        }
        s.payment.safeTransferFrom(msg.sender, s.payee, checkout);
        s.income.safeTransfer(msg.sender, rewardTokenSold);
        emit RewardTokenSold(msg.sender, rewardTokenSold, checkout);
    }

    function manualCloseBilling() external onlyOwner {
        BillingStorage.Layout storage l = BillingStorage.layout();
        BillingStorage.Stage stage = l.stage;
        require(
            stage == BillingStorage.Stage.SALE_ONGOING &&
                block.timestamp > l.saleExpireAt,
            'DeMineAgent: no action required yet'
        );
        uint billing = s.billing;
        s.deposit -= s.statements[s.billing].debt;
        close(l, billing);
    }

    /**
     * @notice Collect income leftover, no waste
     */
    function collectResidue(
        address recipient,
        uint start,
        uint end
    ) external onlyOwner {
        require(end < s.billing, 'DeMineAgent: token not billed yet');
        uint total;
        for (uint id = start; id <= end; id++) {
            uint income = s.statements[s.billing].income;
            uint balance = s.statements[s.billing].income;
            total += income - (income / balance) * balance;
        }
        s.income.safeTransferFrom(address(this), recipient, total);
    }

    function getStatement(uint token) external view returns(Statement memory) {
        return s.statements[token];
    }

    function trySwap(
        address swapRouter,
        address tokenIn,
        address tokenOut,
        uint amountInMaximum,
        uint amountOut
    ) internal returns(bool, uint) {
        TransferHelper.safeApprove(tokenIn, swapRouter, amountInMaximum);
        ISwapRouter.ExactOutputSingleParams memory param =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: 3000, // 0.3%
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
        });
        (bool success, bytes memory encoded) = swapRouter.call(
            abi.encodeWithSignature(
                'exactOutputSingle((address,address,uint24,address,uint,uiint256,uint,uint160))',
                param
            )
        );
        TransferHelper.safeApprove(tokenIn, swapRouter, 0);
        if (success) {
            (uint amountIn) = abi.decode(encoded, (uint));
            return (true, amountIn);
        } else {
            return (false, 0);
        }
    }

    function getNormalizedChainlinkPriceWithDiscount(
        BillingStorage.Layout storage l
    ) private view returns(uint) {
        (,int price, , ,) = l.chainlink.latestRoundData();
        if (price <= 0) { return 0; }
        uint chainlinkBase = 10 ** (l.chainlink.decimals());
        uint normalized = uint(price) * base(s.payment) / chainlinkBase;
        return normalized * l.discount / 10000;
    }

    function base(IERC20 token) private view returns(uint) {
        uint8 decimals = IERC20Metadata(address(token)).decimals();
        return 10 ** decimals;
    }

    function calcUnitPrice(
          uint cost,
          uint income
    ) private pure returns(uint, uint) {
        if (cost > income) {
            /**
              cost = 100, income = 1000, then unit = 10, price = 1,
              which means you have to buy at least 10 income tokens
              each time and each unit cost 1 cost token
            */
            return (1, Util.ceil(cost, income));
        } else {
            /**
              cost = 1000, income = 100, then unit = 1, price = 10,
              which means you can buy at least 1 income token each
              time and each income token cost 10 cost token
            */
            uint unitSize = Util.ceil(income, cost);
            return (unitSize, Util.ceil(cost, income / unitSize));
        }
    }

    function close(BillingStorage.Layout storage l, uint billing) private {
        s.billing = billing + 1;
        l.stage = BillingStorage.Stage.NOT_STARTED;
        emit CloseBilling(billing);
    }
}
