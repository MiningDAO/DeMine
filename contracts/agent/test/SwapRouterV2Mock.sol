// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SwapRouterV2Mock {
    using SafeERC20 for IERC20;
    uint price;
    bool fail;

    function setSuccess(uint _price) external {
        price = _price;
    }

    function setFail(bool _fail) external {
        fail = _fail;
    }

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint
    ) external returns(uint, uint) {
        require(!fail, 'set to fail');
        address tokenIn = path[0];
        address tokenOut = path[1];
        uint amountIn = amountOut / price;
        require(
            amountIn <= amountInMax,
            'insufficient amountIn'
        );
        IERC20(tokenIn).safeTransferFrom(to, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);
        return (amountIn, amountOut);
    }
}
